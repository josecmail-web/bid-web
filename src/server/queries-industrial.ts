import { and, asc, count, desc, eq, inArray, or, sql } from "drizzle-orm";
import { getDb, schema as s, type DB } from "./db";
import { closeExpired, currentYM, ratingsFor, reviewForTender } from "./queries";
import { fileUrl } from "./storage";
import { tanteoForIndustrial } from "./tanteo";
import type { BidResult, CertId, IndustrialTenderCardDTO, IndustrialTenderDTO } from "@/lib/types";

/**
 * Vista del industrial. Puja ciega también hacia él: solo ve su propia oferta,
 * nunca importes ni nº de pujas de otros.
 */

const iso = (d: Date | null) => (d ? d.toISOString() : null);

/** Contexto de elegibilidad de una empresa: oficios, certificados vigentes y valoración. */
export async function eligibilityContext(db: DB, companyId: string) {
  const [c] = await db.select().from(s.companies).where(eq(s.companies.id, companyId));
  const certs = await db.select().from(s.certificates).where(eq(s.certificates.companyId, companyId));
  const valid = new Set(certs.filter((x) => x.status === "ok" && x.expiresAt >= currentYM()).map((x) => x.certType));
  const pending = new Set(certs.filter((x) => x.status === "pending").map((x) => x.certType));
  const r = (await ratingsFor(db, [companyId])).get(companyId)?.r ?? null;
  const avg = r ? (r[0] + r[1] + r[2] + r[3]) / 4 : null;
  return {
    company: c,
    check(sector: string, req: string[], minRating: number | null) {
      const tradeOk = c.trades.includes(sector);
      const missing = req.filter((x) => !valid.has(x)) as CertId[];
      const ratingTooLow = !!minRating && (avg === null || avg < minRating);
      return { tradeOk, missing, missingPending: missing.filter((x) => pending.has(x)), ratingTooLow, ok: tradeOk && !missing.length && !ratingTooLow };
    },
  };
}

type Row = { t: typeof s.tenders.$inferSelect; owner: string; obra: string | null; loc: string | null };

async function toCards(db: DB, companyId: string, rows: Row[]): Promise<IndustrialTenderCardDTO[]> {
  if (!rows.length) return [];
  const ctx = await eligibilityContext(db, companyId);
  const ids = rows.map((r) => r.t.id);
  const counts = await db.select({ id: s.tenderItems.tenderId, n: count() }).from(s.tenderItems).where(inArray(s.tenderItems.tenderId, ids)).groupBy(s.tenderItems.tenderId);
  const mine = await db
    .select({
      bidId: s.bids.id,
      tenderId: s.bids.tenderId,
      updatedAt: s.bids.updatedAt,
      total: sql<number>`sum(${s.bidItems.unitPrice} * ${s.tenderItems.quantity})`.mapWith(Number),
    })
    .from(s.bids)
    .innerJoin(s.bidItems, eq(s.bidItems.bidId, s.bids.id))
    .innerJoin(s.tenderItems, eq(s.tenderItems.id, s.bidItems.tenderItemId))
    .where(and(eq(s.bids.companyId, companyId), inArray(s.bids.tenderId, ids)))
    .groupBy(s.bids.id);
  const tanteo = await tanteoForIndustrial(db, companyId, ids);

  return rows.map(({ t, owner, obra, loc }) => {
    const myT = tanteo.mine.get(t.id);
    const e = ctx.check(t.sector, t.requiredCerts, t.minRating);
    const b = mine.find((m) => m.tenderId === t.id);
    const result: BidResult = t.status === "adjudicada" && b ? (t.awardedBidId === b.bidId ? "won" : "lost") : null;
    return {
      id: t.id, title: t.title, owner, obra: obra ?? "—", loc: loc ?? "—", sector: t.sector, status: t.status,
      closesAt: iso(t.closesAt), itemCount: counts.find((c) => c.id === t.id)?.n ?? 0,
      req: t.requiredCerts as CertId[], minRating: t.minRating,
      eligible: e.ok, missing: e.missing, missingPending: e.missingPending, ratingTooLow: e.ratingTooLow,
      myBid: b ? { total: b.total, updatedAt: b.updatedAt.toISOString() } : null,
      result,
      tanteo: tanteo.has.has(t.id),
      myTanteo: myT ? { ...myT, until: myT.status === "pending" ? iso(t.tanteoUntil) : null } : null,
    };
  });
}

function baseSelect(db: DB) {
  return db
    .select({ t: s.tenders, owner: s.companies.name, obra: s.projects.name, loc: s.projects.location })
    .from(s.tenders)
    .innerJoin(s.companies, eq(s.companies.id, s.tenders.ownerId))
    .leftJoin(s.projects, eq(s.projects.id, s.tenders.projectId));
}

/** Paquetes abiertos de mis oficios (con acceso o bloqueados), por cierre más próximo. */
export async function listOpenForIndustrial(companyId: string) {
  const db = await getDb();
  await closeExpired(db);
  const [c] = await db.select({ trades: s.companies.trades }).from(s.companies).where(eq(s.companies.id, companyId));
  if (!c?.trades.length) return [];
  const rows = await baseSelect(db)
    .where(and(eq(s.tenders.status, "abierta"), eq(s.tenders.scope, "abierta"), inArray(s.tenders.sector, c.trades)))
    .orderBy(asc(s.tenders.closesAt));
  return toCards(db, companyId, rows);
}

/** Paquetes en los que he pujado, más recientes primero. */
export async function listMyBids(companyId: string) {
  const db = await getDb();
  await closeExpired(db);
  const rows = await baseSelect(db)
    .where(sql`exists (select 1 from bids b where b.tender_id = ${s.tenders.id} and b.company_id = ${companyId})`)
    .orderBy(desc(s.tenders.closesAt));
  return toCards(db, companyId, rows);
}

/**
 * Detalle para pujar. Visible si el paquete está abierto y tengo acceso, o si ya he pujado
 * (entonces también después del cierre, en solo lectura).
 */
export async function getTenderForIndustrial(companyId: string, id: string): Promise<IndustrialTenderDTO | null> {
  const db = await getDb();
  await closeExpired(db);
  const [row] = await baseSelect(db).where(eq(s.tenders.id, id));
  if (!row || row.t.status === "borrador") return null;
  const [card] = await toCards(db, companyId, [row]);
  const visible = card.myBid || (row.t.status === "abierta" && row.t.scope === "abierta" && card.eligible);
  if (!visible) return null;

  const items = await db.select().from(s.tenderItems).where(eq(s.tenderItems.tenderId, id)).orderBy(asc(s.tenderItems.position));
  const [project] = row.t.projectId ? await db.select().from(s.projects).where(eq(s.projects.id, row.t.projectId)) : [];
  const files = project ? await db.select().from(s.projectFiles).where(eq(s.projectFiles.projectId, project.id)) : [];
  let myPrices: number[] | null = null;
  const [bid] = await db.select({ id: s.bids.id }).from(s.bids).where(and(eq(s.bids.tenderId, id), eq(s.bids.companyId, companyId)));
  if (bid) {
    const prices = await db.select().from(s.bidItems).where(eq(s.bidItems.bidId, bid.id));
    myPrices = items.map((it) => prices.find((p) => p.tenderItemId === it.id)?.unitPrice ?? 0);
  }
  const [c] = await db.select({ v: s.companies.verification }).from(s.companies).where(eq(s.companies.id, companyId));
  return {
    ...card,
    description: project?.description ?? null,
    startMonth: project?.startMonth ?? null,
    files: files.map((f) => ({ name: f.fileName, url: fileUrl(f.fileKey)! })),
    items: items.map((i) => ({ code: i.code, d: i.description, ...(i.longDescription ? { long: i.longDescription } : {}), u: i.unit, q: i.quantity })),
    myPrices,
    verified: c?.v === "approved",
    // La valoración de la obra solo la ve el adjudicatario
    review: card.result === "won" ? await reviewForTender(db, id, row.t.ownerId) : null,
    fee: card.result === "won" ? await feeOf(db, id) : null,
  };
}

/** ¿Puede este industrial descargar un adjunto de obra? Solo si ve algún paquete de esa obra. */
export async function industrialCanReadProjectFile(companyId: string, key: string) {
  const db = await getDb();
  const tenders = await db
    .select({ id: s.tenders.id })
    .from(s.projectFiles)
    .innerJoin(s.tenders, eq(s.tenders.projectId, s.projectFiles.projectId))
    .where(and(eq(s.projectFiles.fileKey, key), or(eq(s.tenders.status, "abierta"), sql`exists (select 1 from bids b where b.tender_id = ${s.tenders.id} and b.company_id = ${companyId})`)));
  for (const t of tenders) if (await getTenderForIndustrial(companyId, t.id)) return true;
  return false;
}

async function feeOf(db: DB, tenderId: string) {
  const [f] = await db.select().from(s.awardFees).where(eq(s.awardFees.tenderId, tenderId));
  return f ? { amount: f.feeAmount, charged: f.chargedAmount, status: f.status } : null;
}
