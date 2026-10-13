import { and, asc, count, desc, eq, gte, inArray, lte, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { getDb, schema as s, type DB } from "./db";
import { fileUrl } from "./storage";
import { notify } from "./notify";
import { CERTS } from "@/lib/catalog";
import { requiredDocs } from "@/lib/rules";
import type {
  AdminDataDTO,
  BidderDTO,
  CertDTO,
  CertId,
  IndustrialProfileDTO,
  Ratings,
  ReceivedReviewDTO,
  TenderCardDTO,
  TenderDetailDTO,
  WizardState,
} from "@/lib/types";

/* — utilidades — */

const iso = (d: Date | null) => (d ? d.toISOString() : null);
export const cityLabel = (city: string | null, province: string) => (city && city !== province ? `${city}, ${province}` : city ?? province);
export const currentYM = () => {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}`;
};
const monthLabel = (d: Date) => d.toLocaleDateString("es-ES", { month: "short", year: "numeric" }).replace(".", "");
const avg4 = (r: Ratings) => (r[0] + r[1] + r[2] + r[3]) / 4;

/**
 * Cierre de pujas: abierta → evaluacion cuando pasa closes_at. Se ejecuta antes de leer paquetes
 * (barato e idempotente). TODO producción: además, un job programado que avise a tiempo.
 */
export async function closeExpired(db: DB) {
  const closed = await db
    .update(s.tenders)
    .set({ status: "evaluacion" })
    .where(and(eq(s.tenders.status, "abierta"), lte(s.tenders.closesAt, new Date())))
    .returning({ id: s.tenders.id, ownerId: s.tenders.ownerId });
  for (const t of closed) await notify(db, [t.ownerId], "tender_closed", `${t.id} ha cerrado. Ya puedes comparar las ofertas.`, `/partidas/${t.id}`);
}

/** Media por categoría y nº de obras valoradas (valoraciones no ocultas). */
export async function ratingsFor(db: DB, ids: string[]) {
  const out = new Map<string, { r: Ratings | null; jobs: number }>();
  if (!ids.length) return out;
  const rows = await db
    .select({
      id: s.reviews.toCompanyId,
      n: count(),
      q: sql<number>`avg(${s.reviews.quality})`,
      d: sql<number>`avg(${s.reviews.deadlines})`,
      l: sql<number>`avg(${s.reviews.cleanliness})`,
      t: sql<number>`avg(${s.reviews.treatment})`,
    })
    .from(s.reviews)
    .where(and(inArray(s.reviews.toCompanyId, ids), eq(s.reviews.hidden, false)))
    .groupBy(s.reviews.toCompanyId);
  for (const id of ids) out.set(id, { r: null, jobs: 0 });
  for (const r of rows) out.set(r.id, { r: [Number(r.q), Number(r.d), Number(r.l), Number(r.t)], jobs: r.n });
  return out;
}

const certDTO = (c: typeof s.certificates.$inferSelect): CertDTO => ({ id: c.certType as CertId, st: c.status, exp: c.expiresAt, logo: fileUrl(c.logoKey) });

/** Certificados validados y vigentes. */
export async function validCertsFor(db: DB, ids: string[]) {
  const out = new Map<string, CertDTO[]>();
  if (!ids.length) return out;
  const rows = await db
    .select()
    .from(s.certificates)
    .where(and(inArray(s.certificates.companyId, ids), eq(s.certificates.status, "ok"), gte(s.certificates.expiresAt, currentYM())))
    .orderBy(asc(s.certificates.createdAt));
  for (const id of ids) out.set(id, []);
  for (const c of rows) if (c.certType in CERTS) out.get(c.companyId)!.push(certDTO(c));
  return out;
}

/** Totales (Σ precio unitario × medición) por puja. */
async function bidTotals(db: DB, tenderIds: string[]) {
  if (!tenderIds.length) return [];
  return db
    .select({
      bidId: s.bids.id,
      tenderId: s.bids.tenderId,
      companyId: s.bids.companyId,
      total: sql<number>`sum(${s.bidItems.unitPrice} * ${s.tenderItems.quantity})`.mapWith(Number),
    })
    .from(s.bids)
    .innerJoin(s.bidItems, eq(s.bidItems.bidId, s.bids.id))
    .innerJoin(s.tenderItems, eq(s.tenderItems.id, s.bidItems.tenderItemId))
    .where(inArray(s.bids.tenderId, tenderIds))
    .groupBy(s.bids.id);
}

/** Valoración que una promotora hizo en un paquete. */
export async function reviewForTender(db: DB, tenderId: string, fromCompanyId: string) {
  const [rv] = await db
    .select()
    .from(s.reviews)
    .where(and(eq(s.reviews.tenderId, tenderId), eq(s.reviews.fromCompanyId, fromCompanyId)));
  return rv
    ? { r: [rv.quality, rv.deadlines, rv.cleanliness, rv.treatment] as Ratings, comment: rv.comment, date: dateOnly(rv.createdAt) }
    : null;
}

const dateOnly = (d: Date) => d.toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric", timeZone: "Europe/Madrid" }).replace(".", "");

/* — promotora — */

export async function listOwnerTenders(ownerId: string): Promise<TenderCardDTO[]> {
  const db = await getDb();
  await closeExpired(db);
  const rows = await db
    .select({ t: s.tenders, obra: s.projects.name, loc: s.projects.location })
    .from(s.tenders)
    .leftJoin(s.projects, eq(s.projects.id, s.tenders.projectId))
    .where(eq(s.tenders.ownerId, ownerId))
    .orderBy(desc(s.tenders.number));
  const ids = rows.map((r) => r.t.id);
  if (!ids.length) return [];
  const itemCounts = await db.select({ id: s.tenderItems.tenderId, n: count() }).from(s.tenderItems).where(inArray(s.tenderItems.tenderId, ids)).groupBy(s.tenderItems.tenderId);
  const totals = await bidTotals(db, ids);
  const reviewed = await db
    .select({ tenderId: s.reviews.tenderId })
    .from(s.reviews)
    .where(and(inArray(s.reviews.tenderId, ids), eq(s.reviews.fromCompanyId, ownerId)));
  const awardedIds = rows.map((r) => r.t.awardedBidId).filter((x): x is string => !!x);
  const names = awardedIds.length
    ? await db.select({ bidId: s.bids.id, name: s.companies.name }).from(s.bids).innerJoin(s.companies, eq(s.companies.id, s.bids.companyId)).where(inArray(s.bids.id, awardedIds))
    : [];

  return rows.map(({ t, obra, loc }) => {
    const draft = t.draft as WizardState | null;
    const mine = totals.filter((b) => b.tenderId === t.id);
    const open = t.status === "abierta" || t.status === "borrador";
    const awarded = mine.find((b) => b.bidId === t.awardedBidId);
    return {
      id: t.id, title: t.title, sector: t.sector, status: t.status, closesAt: iso(t.closesAt),
      obra: obra ?? draft?.obra ?? "—", loc: loc ?? draft?.loc ?? "—",
      itemCount: t.status === "borrador" ? (draft?.partidas.filter((p) => p.on).length ?? 0) : (itemCounts.find((c) => c.id === t.id)?.n ?? 0),
      sealed: mine.length,
      minTotal: !open && mine.length ? Math.min(...mine.map((b) => b.total)) : null,
      awardedName: names.find((n) => n.bidId === t.awardedBidId)?.name ?? null,
      awardedTotal: awarded?.total ?? null,
      needsReview: t.status === "adjudicada" && !!t.awardedBidId && !reviewed.some((r) => r.tenderId === t.id),
    };
  });
}

export async function getOwnerTender(ownerId: string, id: string): Promise<TenderDetailDTO | null> {
  const db = await getDb();
  await closeExpired(db);
  const [row] = await db
    .select({ t: s.tenders, obra: s.projects.name, loc: s.projects.location })
    .from(s.tenders)
    .leftJoin(s.projects, eq(s.projects.id, s.tenders.projectId))
    .where(and(eq(s.tenders.id, id), eq(s.tenders.ownerId, ownerId)));
  if (!row || row.t.status === "borrador") return null;
  const t = row.t;
  const items = await db.select().from(s.tenderItems).where(eq(s.tenderItems.tenderId, id)).orderBy(asc(s.tenderItems.position));
  const bidRows = await db.select().from(s.bids).where(eq(s.bids.tenderId, id)).orderBy(asc(s.bids.submittedAt));

  const base: TenderDetailDTO = {
    id: t.id, title: t.title, obra: row.obra ?? "—", loc: row.loc ?? "—", sector: t.sector, status: t.status,
    closesAt: iso(t.closesAt), ref: t.referenceBudget, req: t.requiredCerts as CertId[],
    items: items.map((i) => ({ code: i.code, d: i.description, u: i.unit, q: i.quantity })),
    sealed: bidRows.length, bids: [], awardedCompanyId: null, review: null,
  };
  // Puja ciega: con la puja abierta no salen de aquí ni importes ni identidades.
  if (t.status === "abierta" || !bidRows.length) return base;

  const prices = await db.select().from(s.bidItems).where(inArray(s.bidItems.bidId, bidRows.map((b) => b.id)));
  const companyIds = bidRows.map((b) => b.companyId);
  const companies = await db.select().from(s.companies).where(inArray(s.companies.id, companyIds));
  const ratings = await ratingsFor(db, companyIds);
  const certs = await validCertsFor(db, companyIds);

  base.bids = bidRows.map((b) => {
    const c = companies.find((x) => x.id === b.companyId)!;
    const bidder: BidderDTO = {
      id: c.id, name: c.name, city: cityLabel(c.city, c.province),
      jobs: ratings.get(c.id)!.jobs, r: ratings.get(c.id)!.r,
      certCodes: certs.get(c.id)!.map((x) => CERTS[x.id].code),
    };
    return { bidder, p: items.map((it) => prices.find((p) => p.bidId === b.id && p.tenderItemId === it.id)?.unitPrice ?? 0) };
  });
  base.awardedCompanyId = bidRows.find((b) => b.id === t.awardedBidId)?.companyId ?? null;
  base.review = await reviewForTender(db, t.id, ownerId);
  return base;
}

export async function getOwnerProjectNames(ownerId: string) {
  const db = await getDb();
  const rows = await db.select({ name: s.projects.name }).from(s.projects).where(eq(s.projects.ownerId, ownerId)).orderBy(desc(s.projects.createdAt));
  return [...new Set(rows.map((r) => r.name))];
}

export async function getDraft(ownerId: string, id: string): Promise<WizardState | null> {
  const db = await getDb();
  const [t] = await db
    .select({ draft: s.tenders.draft })
    .from(s.tenders)
    .where(and(eq(s.tenders.id, id), eq(s.tenders.ownerId, ownerId), eq(s.tenders.status, "borrador")));
  return t?.draft ? { ...(t.draft as WizardState), draftId: id, step: 0 } : null;
}

/* — industrial — */

export async function getIndustrialProfile(companyId: string): Promise<IndustrialProfileDTO | null> {
  const db = await getDb();
  const [c] = await db.select().from(s.companies).where(and(eq(s.companies.id, companyId), eq(s.companies.type, "industrial")));
  if (!c) return null;
  const rating = (await ratingsFor(db, [c.id])).get(c.id)!;
  const certs = (await validCertsFor(db, [c.id])).get(c.id)!;
  const reviews = await db
    .select({ rv: s.reviews, by: s.companies.name })
    .from(s.reviews)
    .innerJoin(s.companies, eq(s.companies.id, s.reviews.fromCompanyId))
    .where(and(eq(s.reviews.toCompanyId, c.id), eq(s.reviews.hidden, false), sql`${s.reviews.comment} is not null`))
    .orderBy(desc(s.reviews.createdAt))
    .limit(10);
  return {
    id: c.id, name: c.name, city: cityLabel(c.city, c.province), since: c.foundedYear, trades: c.trades,
    jobs: rating.jobs, r: rating.r, certs,
    reviews: reviews.map(({ rv, by }) => ({
      by, obra: rv.obra, date: monthLabel(rv.createdAt), text: rv.comment ?? "",
      r: [rv.quality, rv.deadlines, rv.cleanliness, rv.treatment],
    })),
  };
}

/** Todos los certificados propios (cualquier estado). */
export async function getOwnCerts(companyId: string): Promise<CertDTO[]> {
  const db = await getDb();
  const rows = await db.select().from(s.certificates).where(eq(s.certificates.companyId, companyId)).orderBy(asc(s.certificates.createdAt));
  return rows.filter((c) => c.certType in CERTS).map(certDTO);
}

/* — administración — */

const dayLabel = (d: Date) => d.toLocaleDateString("es-ES", { day: "2-digit", month: "short" }).replace(".", "");

export async function getAdminData(): Promise<AdminDataDTO> {
  const db = await getDb();
  await closeExpired(db);

  const pendingCompanies = await db.select().from(s.companies).where(eq(s.companies.verification, "pending")).orderBy(desc(s.companies.createdAt));
  const docs = pendingCompanies.length
    ? await db.select().from(s.companyDocs).where(inArray(s.companyDocs.companyId, pendingCompanies.map((c) => c.id)))
    : [];
  const verifs = pendingCompanies.map((c) => ({
    id: c.id, name: c.name, type: c.type === "industrial" ? "Industrial" : (c.kind ?? "Promotora"), cif: c.cif, prov: c.province, date: dayLabel(c.createdAt),
    docs: requiredDocs(c.type).map(([kind, , accepts]) => {
      const d = docs.find((x) => x.companyId === c.id && accepts.includes(x.kind));
      return { kind: d?.kind ?? kind, ok: !!d, url: fileUrl(d?.fileKey) };
    }),
  }));

  const pc = await db
    .select({ c: s.certificates, name: s.companies.name })
    .from(s.certificates)
    .innerJoin(s.companies, eq(s.companies.id, s.certificates.companyId))
    .where(eq(s.certificates.status, "pending"))
    .orderBy(asc(s.certificates.createdAt));
  const pendingCerts = pc.filter(({ c }) => c.certType in CERTS).map(({ c, name }) => ({ companyId: c.companyId, companyName: name, cert: certDTO(c), pdf: fileUrl(c.pdfKey) }));

  const trows = await db
    .select({ t: s.tenders, owner: s.companies.name, prov: s.companies.province, n: sql<number>`(select count(*) from bids b where b.tender_id = ${s.tenders.id})`.mapWith(Number) })
    .from(s.tenders)
    .innerJoin(s.companies, eq(s.companies.id, s.tenders.ownerId))
    .where(sql`${s.tenders.status} <> 'borrador'`)
    .orderBy(desc(s.tenders.number));
  const tenders = trows.map(({ t, owner, prov, n }) => ({ id: t.id, title: t.title, owner, prov, status: t.status, n, closesAt: iso(t.closesAt) }));

  const fr = await db
    .select({ rep: s.reviewReports, rv: s.reviews, by: s.companies.name, ind: sql<string>`(select name from companies x where x.id = ${s.reviews.toCompanyId})` })
    .from(s.reviewReports)
    .innerJoin(s.reviews, eq(s.reviews.id, s.reviewReports.reviewId))
    .innerJoin(s.companies, eq(s.companies.id, s.reviews.fromCompanyId))
    .where(eq(s.reviewReports.status, "open"))
    .orderBy(asc(s.reviewReports.createdAt));
  const flagged = fr.map(({ rep, rv, by, ind }) => ({
    id: rep.id, ind, by, obra: rv.obra, reason: rep.reason, text: rv.comment ?? "",
    score: avg4([rv.quality, rv.deadlines, rv.cleanliness, rv.treatment]),
  }));

  const [b7] = await db.select({ n: count() }).from(s.bids).where(gte(s.bids.submittedAt, new Date(Date.now() - 7 * 864e5)));

  const ownerCo = alias(s.companies, "owner_co");
  const feeRows = await db
    .select({ f: s.awardFees, title: s.tenders.title, awardedAt: s.tenders.awardedAt, owner: ownerCo.name, industrial: s.companies.name })
    .from(s.awardFees)
    .innerJoin(s.tenders, eq(s.tenders.id, s.awardFees.tenderId))
    .innerJoin(ownerCo, eq(ownerCo.id, s.tenders.ownerId))
    .innerJoin(s.companies, eq(s.companies.id, s.awardFees.companyId))
    .orderBy(desc(s.awardFees.createdAt));
  const fees = {
    rows: feeRows.map(({ f, title, awardedAt, owner, industrial }) => ({
      tenderId: f.tenderId, title, owner, industrial, date: dayLabel(awardedAt ?? f.createdAt),
      total: f.awardedTotal, fee: f.feeAmount, charged: f.chargedAmount, status: f.status,
    })),
    totals: {
      n: feeRows.length,
      awarded: feeRows.reduce((a, r) => a + r.f.awardedTotal, 0),
      fee: feeRows.reduce((a, r) => a + r.f.feeAmount, 0),
      charged: feeRows.reduce((a, r) => a + r.f.chargedAmount, 0),
    },
  };
  return {
    fees,
    kpis: { verifs: verifs.length, open: tenders.filter((t) => t.status === "abierta").length, bids7d: b7.n, flagged: flagged.length },
    verifs, pendingCerts, tenders, flagged,
  };
}

/** Todas las valoraciones recibidas por un industrial, con su estado de reporte. */
export async function getReceivedReviews(companyId: string): Promise<ReceivedReviewDTO[]> {
  const db = await getDb();
  const rows = await db
    .select({ rv: s.reviews, by: s.companies.name })
    .from(s.reviews)
    .innerJoin(s.companies, eq(s.companies.id, s.reviews.fromCompanyId))
    .where(eq(s.reviews.toCompanyId, companyId))
    .orderBy(desc(s.reviews.createdAt))
    .limit(60);
  const reports = rows.length
    ? await db.select().from(s.reviewReports).where(inArray(s.reviewReports.reviewId, rows.map((r) => r.rv.id))).orderBy(desc(s.reviewReports.createdAt))
    : [];
  return rows.map(({ rv, by }) => {
    const rep = reports.find((x) => x.reviewId === rv.id);
    return {
      id: rv.id, by, obra: rv.obra, tenderId: rv.tenderId, date: dateOnly(rv.createdAt),
      r: [rv.quality, rv.deadlines, rv.cleanliness, rv.treatment], text: rv.comment, hidden: rv.hidden,
      report: rep ? { status: rep.status, reason: rep.reason } : null,
    };
  });
}
