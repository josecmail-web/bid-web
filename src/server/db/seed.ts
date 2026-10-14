import { sql } from "drizzle-orm";
import type { DB } from "./index";
import * as s from "./schema";
import { hashPassword } from "../password";
import { withCifControl } from "../../lib/taxid";
import { recordAwardFee } from "../fees";
import { TERMS_VERSION } from "../../lib/pricing";
import { DEMO_PASSWORD, DEMO_USERS, FILLER_OBRAS, GENERATED, INDUSTRIALS, PENDING, PROMOTORAS, REPORTS, TENDERS, exp, type R4, type SeedIndustrial } from "./seed-data";

/** Generador pseudoaleatorio determinista (mulberry32) para que la demo sea siempre igual. */
function prng(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const half = (x: number) => Math.min(5, Math.max(1, Math.round(x * 2) / 2));
const monthDate = (m: string, day = 15) => new Date(`${m}-${String(day).padStart(2, "0")}T12:00:00+02:00`);
const tenderId = (n: number) => "LIC-" + String(n).padStart(4, "0");

/** CIF con formato válido y determinista. */
let cifN = 0;
const fakeCif = () => {
  cifN++;
  return withCifControl("B" + String(4600000 + cifN * 7919).padStart(7, "0").slice(-7));
};

export async function seed(db: DB) {
  const rnd = prng(2026);
  const now = new Date();

  await db.transaction(async (tx) => {
    /* — promotoras — */
    const promo: Record<string, string> = {};
    const promoByName: Record<string, string> = {};
    for (const p of PROMOTORAS) {
      const [row] = await tx
        .insert(s.companies)
        .values({ type: "promotora", kind: p.kind, name: p.name, cif: withCifControl(p.cif.slice(0, 8)), province: p.province, city: p.city, email: p.email, annualVolume: p.vol, verification: "approved", verifiedAt: new Date("2025-01-15") })
        .returning({ id: s.companies.id });
      promo[p.key] = row.id;
      promoByName[p.name] = row.id;
      await tx.insert(s.companyDocs).values([{ companyId: row.id, kind: "CIF" }, { companyId: row.id, kind: "Escrituras" }]);
    }

    /* — industriales: los del prototipo + generados por oficio — */
    const all: SeedIndustrial[] = [...INDUSTRIALS];
    const byTrade: Record<string, string[]> = {};
    for (const g of GENERATED) {
      byTrade[g.trade] = [];
      g.names.forEach(([name, city, province], i) => {
        const key = `${g.trade}-${i}`;
        const base = 3.6 + rnd() * 1.2;
        const r = [0, 1, 2, 3].map(() => Math.min(5, Math.round((base + (rnd() - 0.5) * 0.5) * 10) / 10)) as R4;
        const jobs = 3 + Math.floor(rnd() * 28);
        const certs = g.certs.map((id) => ({ id, st: "ok" as const, exp: exp(2027 + Math.floor(rnd() * 3), 1 + Math.floor(rnd() * 12)) }));
        all.push({ key, name, city, province, since: 1995 + Math.floor(rnd() * 28), trades: [g.trade], r, jobs, certs, reviews: [] });
        byTrade[g.trade].push(key);
      });
    }

    const ind: Record<string, string> = {};
    const promoIds = Object.values(promo);
    for (const it of all) {
      const [row] = await tx
        .insert(s.companies)
        .values({ type: "industrial", name: it.name, cif: fakeCif(), province: it.province, city: it.city, email: `obras@${it.key.toLowerCase().replace(/[^a-z0-9]/g, "")}.bid-demo.es`, trades: it.trades, radius: "Comunidad", foundedYear: it.since, verification: "approved", verifiedAt: new Date("2025-02-01") })
        .returning({ id: s.companies.id });
      ind[it.key] = row.id;
      await tx.insert(s.companyDocs).values(["CIF", "REA", "Seguro RC"].map((kind) => ({ companyId: row.id, kind })));
      if (it.certs.length) {
        await tx.insert(s.certificates).values(
          it.certs.map((c) => ({ companyId: row.id, certType: c.id, status: c.st, expiresAt: c.exp, reviewedAt: c.st === "pending" ? null : new Date("2025-03-01"), createdAt: c.st === "pending" ? new Date("2026-10-05") : new Date("2025-03-01") })),
        );
      }

      /* Valoraciones: las del diseño (con comentario) + relleno sin comentario cuya media por
         categoría se aproxima a la del prototipo. */
      if (it.r && it.jobs) {
        const rows: (typeof s.reviews.$inferInsert)[] = it.reviews.map((rv) => ({
          fromCompanyId: promoByName[rv.by], toCompanyId: row.id, obra: rv.obra,
          quality: rv.r[0], deadlines: rv.r[1], cleanliness: rv.r[2], treatment: rv.r[3], comment: rv.text, createdAt: monthDate(rv.month),
        }));
        const sums = [0, 1, 2, 3].map((k) => it.reviews.reduce((a, rv) => a + rv.r[k], 0));
        const m = it.jobs - it.reviews.length;
        for (let i = 0; i < m; i++) {
          const v = [0, 1, 2, 3].map((k) => {
            const x = half((it.r![k] * it.jobs - sums[k]) / (m - i));
            sums[k] += x;
            return x;
          });
          const monthsAgo = 3 + Math.floor(rnd() * 30);
          const d = new Date(now.getFullYear(), now.getMonth() - monthsAgo, 1 + Math.floor(rnd() * 27), 12);
          rows.push({
            fromCompanyId: promoIds[Math.floor(rnd() * promoIds.length)], toCompanyId: row.id, obra: FILLER_OBRAS[Math.floor(rnd() * FILLER_OBRAS.length)],
            quality: v[0], deadlines: v[1], cleanliness: v[2], treatment: v[3], comment: null, createdAt: d,
          });
        }
        await tx.insert(s.reviews).values(rows);
      }
    }

    /* — empresas pendientes de verificación — */
    for (const p of PENDING) {
      const [row] = await tx
        .insert(s.companies)
        .values({ type: p.type, kind: "kind" in p ? p.kind : null, name: p.name, cif: withCifControl(p.cif.slice(0, 8)), province: p.province, email: p.email, trades: "trades" in p ? p.trades : [], radius: p.type === "industrial" ? "Provincia" : null, verification: "pending", createdAt: new Date(p.date + "T10:00:00+02:00") })
        .returning({ id: s.companies.id });
      await tx.insert(s.companyDocs).values(p.docs.map((kind) => ({ companyId: row.id, kind, fileName: kind.toLowerCase().replace(/\s/g, "-") + ".pdf", uploadedAt: new Date(p.date + "T10:00:00+02:00") })));
    }

    /* — obras, paquetes, partidas y pujas — */
    const projectIds: Record<string, string> = {};
    for (const t of TENDERS) {
      const id = tenderId(t.number);
      const ownerId = promo[t.owner];
      const closesAt =
        t.closes === null ? null : typeof t.closes === "string" ? new Date(t.closes) : new Date(now.getFullYear(), now.getMonth(), now.getDate() + t.closes.inDays, 18);

      let projectId: string | null = null;
      if (t.status !== "borrador") {
        const pk = t.owner + "|" + t.obra;
        if (!projectIds[pk]) {
          const [p] = await tx.insert(s.projects).values({ ownerId, name: t.obra, location: t.loc }).returning({ id: s.projects.id });
          projectIds[pk] = p.id;
        }
        projectId = projectIds[pk];
      }

      const draft =
        t.status === "borrador"
          ? {
              step: 0, draftId: id, obra: t.obra, loc: t.loc, start: "", desc: "", files: [], fileName: "", importNote: "",
              partidas: t.items.map(([code, d, u, q], i) => ({ id: i + 1, code, d, u, q, sector: t.sector, on: true })),
              close: "", scope: "abierta", min: "Cualquiera", refs: {}, extra: [], tanteo: [],
            }
          : null;

      const published = closesAt ? new Date(closesAt.getTime() - 14 * 864e5) : null;
      await tx.insert(s.tenders).values({
        id, number: t.number, ownerId, projectId, sector: t.sector, title: t.title, status: t.status, closesAt, referenceBudget: t.ref,
        requiredCerts: t.req, minRating: t.minRating ?? null, draft, publishedAt: published, createdAt: published ?? now,
      });
      const items = await tx
        .insert(s.tenderItems)
        .values(t.items.map(([code, description, unit, quantity], position) => ({ tenderId: id, position, code, description, unit, quantity })))
        .returning({ id: s.tenderItems.id, position: s.tenderItems.position });
      items.sort((a, b) => a.position - b.position);
      if (t.tanteo?.length) await tx.insert(s.tenderTanteo).values(t.tanteo.map((k) => ({ tenderId: id, companyId: ind[k] })));

      const bidSpecs: { company: string; p: number[] }[] = (t.bids ?? []).map((b) => ({ company: ind[b.ind], p: b.p }));
      if (t.generatedBids) {
        for (const key of byTrade[t.generatedBids.trade].slice(0, t.generatedBids.count)) {
          const f = 0.86 + rnd() * 0.3;
          bidSpecs.push({ company: ind[key], p: t.items.map((it) => Math.round(it[4] * f * (0.95 + rnd() * 0.1) * 2) / 2) });
        }
      }

      let awardedBidId: string | null = null;
      let best = Infinity;
      for (const b of bidSpecs) {
        const submitted = new Date((closesAt ?? now).getTime() - (1 + rnd() * 9) * 864e5);
        const [bid] = await tx
          .insert(s.bids)
          .values({ tenderId: id, companyId: b.company, submittedAt: submitted, updatedAt: submitted })
          .returning({ id: s.bids.id });
        await tx.insert(s.bidItems).values(items.map((it, i) => ({ bidId: bid.id, tenderItemId: it.id, unitPrice: b.p[i] })));
        const total = t.items.reduce((a, it, i) => a + it[3] * b.p[i], 0);
        if (t.awarded === "lowest" ? total < best : t.awarded && b.company === ind[t.awarded]) {
          best = total;
          awardedBidId = bid.id;
        }
      }
      if (awardedBidId) {
        await tx.update(s.tenders).set({ awardedBidId, awardedAt: closesAt ? new Date(closesAt.getTime() + 3 * 864e5) : now }).where(sql`${s.tenders.id} = ${id}`);
        const [w] = await tx.select({ companyId: s.bids.companyId }).from(s.bids).where(sql`${s.bids.id} = ${awardedBidId}`);
        await recordAwardFee(tx as unknown as DB, { tenderId: id, bidId: awardedBidId, companyId: w.companyId, total: Math.round(best * 100) / 100 });
      }
    }
    await tx.execute(sql`select setval('tender_number_seq', ${Math.max(...TENDERS.map((t) => t.number))})`);

    /* — valoraciones reportadas — */
    for (const [indKey, by, obra, reason] of REPORTS) {
      const [rv] = await tx
        .select({ id: s.reviews.id })
        .from(s.reviews)
        .where(sql`${s.reviews.toCompanyId} = ${ind[indKey]} and ${s.reviews.fromCompanyId} = ${promoByName[by]} and ${s.reviews.obra} = ${obra}`);
      if (rv) await tx.insert(s.reviewReports).values({ reviewId: rv.id, reason, createdAt: new Date("2026-10-07T09:00:00+02:00") });
    }

    /* — avisos de ejemplo para las cuentas de demo — */
    const hAgo = (h: number) => new Date(now.getTime() - h * 3600e3);
    await tx.insert(s.notifications).values([
      { companyId: promo.levante, kind: "tender_closed", message: "LIC-0241 ha cerrado. Ya puedes comparar las ofertas.", link: "/partidas/LIC-0241", createdAt: hAgo(30) },
      { companyId: promo.levante, kind: "company_approved", message: "Tu empresa ha sido verificada. Ya puedes publicar partidas.", link: "/partidas/nueva", createdAt: hAgo(24 * 40), readAt: hAgo(24 * 39) },
      { companyId: ind.h, kind: "tender_published", message: "Nuevo paquete de Fontanería: Fontanería y saneamiento · Residencial Altea Hills · 32 viviendas (LIC-0239).", link: "/industrial/paquetes/LIC-0239", createdAt: hAgo(5) },
      { companyId: ind.h, kind: "tender_published", message: "Nuevo paquete de Fontanería: Fontanería y saneamiento · Centro de salud Benicalap (LIC-0236). Exige ISO 45001.", link: "/industrial/paquetes", createdAt: hAgo(28) },
      { companyId: ind.h, kind: "tender_awarded", message: "Te han adjudicado LIC-0231 · Fontanería y saneamiento.", link: "/industrial/paquetes/LIC-0231", createdAt: hAgo(24 * 90), readAt: hAgo(24 * 89) },
    ]);

    /* — usuarios de demo — */
    const pw = await hashPassword(DEMO_PASSWORD);
    const terms = { termsVersion: TERMS_VERSION, termsAcceptedAt: now };
    await tx.insert(s.users).values([
      { email: DEMO_USERS.promotora.email, passwordHash: pw, role: "promotora", companyId: promo[DEMO_USERS.promotora.company], ...terms },
      { email: DEMO_USERS.industrial.email, passwordHash: pw, role: "industrial", companyId: ind[DEMO_USERS.industrial.company], ...terms },
      { email: DEMO_USERS.admin.email, passwordHash: pw, role: "admin", companyId: null, ...terms },
    ]);
  });
}

/** Vacía todas las tablas y vuelve a sembrar (solo modo demo). */
export async function resetAndSeed(db: DB) {
  await db.execute(
    sql`truncate table tender_tanteo, award_fees, auth_attempts, auth_tokens, notifications, review_reports, reviews, bid_items, bids, tender_items, tenders, project_files, projects, certificates, company_docs, sessions, users, companies restart identity cascade`,
  );
  cifN = 0;
  await seed(db);
}
