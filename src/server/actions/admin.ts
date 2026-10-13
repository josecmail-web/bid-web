"use server";

import { and, eq } from "drizzle-orm";
import { refresh } from "next/cache";
import { requireAction } from "../auth";
import { getDb, schema as s } from "../db";
import { notify } from "../notify";
import { safe, UserError } from "../action-utils";
import { CERTS, unlockTxt } from "@/lib/catalog";
import { requiredDocs } from "@/lib/rules";
import type { ActionResult, CertId } from "@/lib/types";

async function pendingCompany(id: string) {
  const db = await getDb();
  const [c] = await db.select().from(s.companies).where(and(eq(s.companies.id, id), eq(s.companies.verification, "pending")));
  if (!c) throw new UserError("Esta solicitud ya no está pendiente.");
  const docs = await db.select({ kind: s.companyDocs.kind }).from(s.companyDocs).where(eq(s.companyDocs.companyId, id));
  const missing = requiredDocs(c.type).filter(([, , accepts]) => !docs.some((d) => accepts.includes(d.kind))).map(([k]) => k);
  return { db, c, missing };
}

export async function approveCompany(id: string): Promise<ActionResult<{ name: string }>> {
  return safe(async () => {
    await requireAction("admin");
    const { db, c, missing } = await pendingCompany(id);
    if (missing.length) throw new UserError("Falta documentación: " + missing.join(", ") + ".");
    await db.update(s.companies).set({ verification: "approved", verifiedAt: new Date() }).where(eq(s.companies.id, id));
    await notify(db, [id], "company_approved", "Tu empresa ha sido verificada. Ya puedes " + (c.type === "industrial" ? "pujar." : "publicar partidas."), c.type === "industrial" ? "/industrial/paquetes" : "/partidas/nueva");
    refresh();
    return { ok: true, name: c.name };
  });
}

export async function rejectCompany(id: string): Promise<ActionResult<{ name: string }>> {
  return safe(async () => {
    await requireAction("admin");
    const { db, c } = await pendingCompany(id);
    await db.update(s.companies).set({ verification: "rejected" }).where(eq(s.companies.id, id));
    await notify(db, [id], "company_rejected", "No hemos podido verificar tu empresa. Contacta con BID para más información.");
    refresh();
    return { ok: true, name: c.name };
  });
}

export async function requestDocs(id: string): Promise<ActionResult<{ name: string; missing: string[] }>> {
  return safe(async () => {
    await requireAction("admin");
    const { db, c, missing } = await pendingCompany(id);
    if (!missing.length) throw new UserError("No falta ningún documento.");
    await notify(db, [id], "docs_requested", "Para verificar tu empresa necesitamos: " + missing.join(", ") + ".");
    return { ok: true, name: c.name, missing };
  });
}

async function reviewCert(companyId: string, certType: string, status: "ok" | "rejected") {
  const admin = await requireAction("admin");
  if (!(certType in CERTS)) throw new UserError("Certificado no válido.");
  const db = await getDb();
  const upd = await db
    .update(s.certificates)
    .set({ status, reviewedBy: admin.userId, reviewedAt: new Date() })
    .where(and(eq(s.certificates.companyId, companyId), eq(s.certificates.certType, certType), eq(s.certificates.status, "pending")))
    .returning({ id: s.certificates.id });
  if (!upd.length) throw new UserError("Este certificado ya no está pendiente.");
  const [c] = await db.select({ name: s.companies.name }).from(s.companies).where(eq(s.companies.id, companyId));
  const code = CERTS[certType as CertId].code;
  await notify(
    db, [companyId], status === "ok" ? "cert_approved" : "cert_rejected",
    status === "ok" ? `${code} validado. ${unlockTxt(certType as CertId)}.` : `${code} rechazado. Revisa el documento y vuelve a enviarlo.`,
    "/industrial/perfil",
  );
  refresh();
  return { code, name: c.name };
}

export async function approveCertificate(companyId: string, certType: string): Promise<ActionResult<{ code: string; name: string }>> {
  return safe(async () => ({ ok: true, ...(await reviewCert(companyId, certType, "ok")) }));
}

export async function rejectCertificate(companyId: string, certType: string): Promise<ActionResult<{ code: string; name: string }>> {
  return safe(async () => ({ ok: true, ...(await reviewCert(companyId, certType, "rejected")) }));
}

/** Resuelve un reporte: mantener la valoración u ocultarla del perfil. */
export async function resolveReport(reportId: string, hide: boolean): Promise<ActionResult<{ ind: string }>> {
  return safe(async () => {
    await requireAction("admin");
    const db = await getDb();
    const [r] = await db
      .select({ reviewId: s.reviewReports.reviewId, toId: s.reviews.toCompanyId, ind: s.companies.name })
      .from(s.reviewReports)
      .innerJoin(s.reviews, eq(s.reviews.id, s.reviewReports.reviewId))
      .innerJoin(s.companies, eq(s.companies.id, s.reviews.toCompanyId))
      .where(and(eq(s.reviewReports.id, reportId), eq(s.reviewReports.status, "open")));
    if (!r) throw new UserError("Este reporte ya está resuelto.");
    await db.transaction(async (tx) => {
      await tx.update(s.reviewReports).set({ status: hide ? "hidden" : "kept", resolvedAt: new Date() }).where(eq(s.reviewReports.id, reportId));
      if (hide) await tx.update(s.reviews).set({ hidden: true }).where(eq(s.reviews.id, r.reviewId));
    });
    await notify(db, [r.toId], "report_resolved", hide ? "Hemos ocultado la valoración que reportaste." : "Hemos revisado tu reporte y la valoración se mantiene.", "/industrial/perfil");
    refresh();
    return { ok: true, ind: r.ind };
  });
}
