"use server";

import { and, eq } from "drizzle-orm";
import { refresh } from "next/cache";
import { requireAction } from "../auth";
import { getDb, schema as s } from "../db";
import { isFile, putFile } from "../storage";
import { eligibleIndustrials } from "../eligibility";
import { closeExpired, currentYM } from "../queries";
import { getTenderForIndustrial } from "../queries-industrial";
import { readPriceSheet } from "../excel";
import type { PriceImport } from "@/lib/prices";
import { safe, str, UserError } from "../action-utils";
import { CERTS } from "@/lib/catalog";
import type { ActionResult } from "@/lib/types";

/** Alta (o reenvío tras rechazo) de un certificado: queda pendiente de validación por BID. */
export async function addCertificate(fd: FormData): Promise<ActionResult> {
  return safe(async () => {
    const user = await requireAction("industrial");
    const certType = str(fd.get("certType"));
    const exp = str(fd.get("exp"));
    const pdf = fd.get("pdf");
    const logo = fd.get("logo");
    if (!(certType in CERTS)) throw new UserError("Elige el tipo de certificado.");
    if (!/^\d{4}-\d{2}$/.test(exp)) throw new UserError("Indica la fecha de caducidad.");
    if (exp < currentYM()) throw new UserError("Ese certificado ya ha caducado.");
    if (!isFile(pdf)) throw new UserError("Adjunta el certificado en PDF para que podamos validarlo.");

    const db = await getDb();
    const [existing] = await db.select().from(s.certificates).where(and(eq(s.certificates.companyId, user.companyId), eq(s.certificates.certType, certType)));
    if (existing && existing.status !== "rejected") throw new UserError("Ya tienes este certificado registrado.");

    const values = {
      status: "pending" as const, expiresAt: exp, pdfKey: await putFile("certs", user.companyId, pdf),
      logoKey: isFile(logo) ? await putFile("logos", user.companyId, logo) : (existing?.logoKey ?? null),
      reviewedAt: null, reviewedBy: null, createdAt: new Date(),
    };
    if (existing) await db.update(s.certificates).set(values).where(eq(s.certificates.id, existing.id));
    else await db.insert(s.certificates).values({ companyId: user.companyId, certType, ...values });
    refresh();
    return { ok: true };
  });
}

export async function setCertificateLogo(fd: FormData): Promise<ActionResult> {
  return safe(async () => {
    const user = await requireAction("industrial");
    const certType = str(fd.get("certType"));
    const logo = fd.get("logo");
    if (!isFile(logo)) throw new UserError("Selecciona una imagen.");
    const db = await getDb();
    const key = await putFile("logos", user.companyId, logo);
    const upd = await db
      .update(s.certificates)
      .set({ logoKey: key })
      .where(and(eq(s.certificates.companyId, user.companyId), eq(s.certificates.certType, certType)))
      .returning({ id: s.certificates.id });
    if (!upd.length) throw new UserError("Certificado no encontrado.");
    refresh();
    return { ok: true };
  });
}

/**
 * Envía o actualiza la puja (editable hasta el cierre). Desglose obligatorio: un precio unitario
 * por partida, en el orden de las partidas del paquete. (La interfaz de puja está pendiente de diseño.)
 */
export async function submitBid(tenderId: string, unitPrices: number[]): Promise<ActionResult> {
  return safe(async () => {
    const user = await requireAction("industrial");
    if (user.verification !== "approved") throw new UserError("Tu empresa está pendiente de verificación.");
    const db = await getDb();
    await closeExpired(db);
    const [t] = await db.select().from(s.tenders).where(eq(s.tenders.id, tenderId));
    if (!t || t.status !== "abierta" || !t.closesAt || t.closesAt <= new Date()) throw new UserError("Esta partida no admite pujas.");
    if (t.scope === "invitacion") throw new UserError("Esta partida es solo para industriales invitados.");
    const ok = await eligibleIndustrials(db, t.sector, t.requiredCerts, t.minRating, [user.companyId]);
    if (!ok.length) throw new UserError("No cumples los requisitos de esta partida (oficio, certificados o valoración mínima).");

    const items = await db.select({ id: s.tenderItems.id }).from(s.tenderItems).where(eq(s.tenderItems.tenderId, t.id)).orderBy(s.tenderItems.position);
    if (unitPrices.length !== items.length || unitPrices.some((p) => !Number.isFinite(p) || p <= 0 || p > 1e9))
      throw new UserError("Indica un precio unitario válido para cada partida.");

    await db.transaction(async (tx) => {
      const [existing] = await tx.select().from(s.bids).where(and(eq(s.bids.tenderId, t.id), eq(s.bids.companyId, user.companyId)));
      const bidId = existing
        ? (await tx.update(s.bids).set({ updatedAt: new Date() }).where(eq(s.bids.id, existing.id)).returning({ id: s.bids.id }))[0].id
        : (await tx.insert(s.bids).values({ tenderId: t.id, companyId: user.companyId }).returning({ id: s.bids.id }))[0].id;
      await tx.delete(s.bidItems).where(eq(s.bidItems.bidId, bidId));
      await tx.insert(s.bidItems).values(items.map((it, i) => ({ bidId, tenderItemId: it.id, unitPrice: Math.round(unitPrices[i] * 100) / 100 })));
    });
    refresh();
    return { ok: true };
  });
}

/** Lee un Excel con precios y devuelve los precios casados con las partidas. No envía la puja. */
export async function importBidPrices(tenderId: string, fd: FormData): Promise<PriceImport> {
  return safe(async () => {
    const user = await requireAction("industrial");
    const T = await getTenderForIndustrial(user.companyId, tenderId);
    if (!T || T.status !== "abierta") throw new UserError("Esta partida no admite pujas.");
    const file = fd.get("file");
    if (!isFile(file)) throw new UserError("Selecciona un fichero.");
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
    if (!["xlsx", "xls", "csv", "ods"].includes(ext)) throw new UserError("Sube un fichero .xlsx, .xls, .ods o .csv.");
    if (file.size > 10 * 1024 * 1024) throw new UserError(file.name + " supera los 10 MB.");
    return readPriceSheet(file, T.items);
  }) as Promise<PriceImport>;
}

/** Reporta una valoración recibida para que la revise el equipo de BID (una vez por valoración). */
export async function reportReview(reviewId: string, reason: string): Promise<ActionResult> {
  return safe(async () => {
    const user = await requireAction("industrial");
    const text = String(reason ?? "").trim().slice(0, 1000);
    if (text.length < 20) throw new UserError("Explica el motivo con un poco más de detalle (mínimo 20 caracteres).");
    const db = await getDb();
    const [rv] = await db.select().from(s.reviews).where(and(eq(s.reviews.id, reviewId), eq(s.reviews.toCompanyId, user.companyId)));
    if (!rv) throw new UserError("Valoración no encontrada.");
    if (rv.hidden) throw new UserError("Esta valoración ya está oculta.");
    const [existing] = await db.select({ id: s.reviewReports.id }).from(s.reviewReports).where(eq(s.reviewReports.reviewId, reviewId));
    if (existing) throw new UserError("Ya reportaste esta valoración.");
    await db.insert(s.reviewReports).values({ reviewId, reason: text });
    refresh();
    return { ok: true };
  });
}
