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
import { afterTanteoAnswer } from "../tanteo";
import { eur, eur2 } from "@/lib/format";
import type { PriceImport } from "@/lib/prices";
import { safe, str, UserError } from "../action-utils";
import { CERTS } from "@/lib/catalog";
import type { ActionResult } from "@/lib/types";

/** Alta (o reenvío tras rechazo) de un certificado: queda pendiente de validación por Bidra. */
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
    if (!ok.length) throw new UserError("No cumples los requisitos de esta partida (sector, certificados o valoración mínima).");

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

/** Titular del tanteo con plazo abierto para este paquete (o error explicativo). */
async function pendingTanteo(tenderId: string) {
  const user = await requireAction("industrial");
  const db = await getDb();
  await closeExpired(db); // también vence los plazos de tanteo
  const [row] = await db
    .select({ r: s.tenderTanteo, t: s.tenders })
    .from(s.tenderTanteo)
    .innerJoin(s.tenders, eq(s.tenders.id, s.tenderTanteo.tenderId))
    .where(and(eq(s.tenderTanteo.tenderId, tenderId), eq(s.tenderTanteo.companyId, user.companyId)));
  if (!row) throw new UserError("No tienes derecho de tanteo en este paquete.");
  if (row.r.status === "matched" || row.r.status === "declined") throw new UserError("Ya has respondido a este derecho de tanteo.");
  if (row.r.status !== "pending" || row.t.status !== "evaluacion" || !row.t.tanteoUntil || row.t.tanteoUntil <= new Date())
    throw new UserError("El plazo para ejercer el derecho de tanteo ha terminado.");
  return { user, db, r: row.r, t: row.t };
}

/**
 * Ejerce el derecho de tanteo: nuevos precios por partida cuyo total iguale (o mejore) la mejor oferta.
 * Sustituye a la puja del titular.
 */
export async function exerciseTanteo(tenderId: string, unitPrices: number[]): Promise<ActionResult<{ total: number }>> {
  return safe(async () => {
    const { user, db, r, t } = await pendingTanteo(tenderId);
    const items = await db
      .select({ id: s.tenderItems.id, q: s.tenderItems.quantity })
      .from(s.tenderItems)
      .where(eq(s.tenderItems.tenderId, t.id))
      .orderBy(s.tenderItems.position);
    if (unitPrices.length !== items.length || unitPrices.some((p) => !Number.isFinite(p) || p <= 0 || p > 1e9))
      throw new UserError("Indica un precio unitario válido para cada partida.");
    const rounded = unitPrices.map((p) => Math.round(p * 100) / 100);
    const total = rounded.reduce((a, p, i) => a + p * items[i].q, 0);
    if (total > r.bestTotal! + 0.01)
      throw new UserError(`Para igualar la mejor oferta tu total debe ser como máximo ${eur2(r.bestTotal!)}. Ahora es ${eur2(total)}.`);

    const [bid] = await db.select({ id: s.bids.id }).from(s.bids).where(and(eq(s.bids.tenderId, t.id), eq(s.bids.companyId, user.companyId)));
    if (!bid) throw new UserError("No encontramos tu puja en este paquete.");
    await db.transaction(async (tx) => {
      await tx.update(s.bids).set({ updatedAt: new Date() }).where(eq(s.bids.id, bid.id));
      await tx.delete(s.bidItems).where(eq(s.bidItems.bidId, bid.id));
      await tx.insert(s.bidItems).values(items.map((it, i) => ({ bidId: bid.id, tenderItemId: it.id, unitPrice: rounded[i] })));
      await tx
        .update(s.tenderTanteo)
        .set({ status: "matched", decidedAt: new Date() })
        .where(and(eq(s.tenderTanteo.tenderId, t.id), eq(s.tenderTanteo.companyId, user.companyId)));
    });
    await afterTanteoAnswer(db, t, `${user.companyName} ha ejercido su derecho de tanteo en ${t.id}: iguala la mejor oferta con ${eur(total)} (antes ${eur(r.originalTotal ?? 0)}).`);
    refresh();
    return { ok: true, total };
  });
}

/** Renuncia al derecho de tanteo: se mantiene su oferta original. */
export async function declineTanteo(tenderId: string): Promise<ActionResult> {
  return safe(async () => {
    const { user, db, t } = await pendingTanteo(tenderId);
    await db
      .update(s.tenderTanteo)
      .set({ status: "declined", decidedAt: new Date() })
      .where(and(eq(s.tenderTanteo.tenderId, t.id), eq(s.tenderTanteo.companyId, user.companyId)));
    await afterTanteoAnswer(db, t, `${user.companyName} ha renunciado a su derecho de tanteo en ${t.id}; se mantiene su oferta original.`);
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

/** Reporta una valoración recibida para que la revise el equipo de Bidra (una vez por valoración). */
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
