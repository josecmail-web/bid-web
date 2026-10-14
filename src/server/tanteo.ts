import { and, eq, inArray, lte, sql } from "drizzle-orm";
import { schema as s, type DB } from "./db";
import { notify } from "./notify";
import { TANTEO_HOURS } from "@/lib/rules";
import { closeLabel, eur } from "@/lib/format";
import type { TanteoStatus, TenderDetailDTO } from "@/lib/types";

/**
 * Derecho de tanteo: la promotora reserva a uno o varios industriales la opción de igualar la mejor
 * oferta durante las 72 h siguientes al cierre. Los demás saben que el paquete lo tiene, no quién.
 *
 *   puja abierta   holder
 *   al cierre      nobid (no pujó: lo pierde) · best (ya es la mejor oferta) · pending (puede igualar)
 *   plazo          pending → matched (iguala el mejor total) | declined | expired
 *
 * Mientras quede algún titular en pending y no haya vencido el plazo, la promotora no puede adjudicar.
 * Si varios igualan, la promotora elige.
 */

/** Total de cada puja de un paquete. */
async function totalsFor(db: DB, tenderId: string) {
  return db
    .select({ companyId: s.bids.companyId, total: sql<number>`sum(${s.bidItems.unitPrice} * ${s.tenderItems.quantity})`.mapWith(Number) })
    .from(s.bids)
    .innerJoin(s.bidItems, eq(s.bidItems.bidId, s.bids.id))
    .innerJoin(s.tenderItems, eq(s.tenderItems.id, s.bidItems.tenderItemId))
    .where(eq(s.bids.tenderId, tenderId))
    .groupBy(s.bids.id);
}

/** Al cerrar la puja: situación de cada titular. Devuelve el fin del plazo si alguno puede igualar. */
export async function startTanteo(db: DB, t: { id: string; title: string }): Promise<Date | null> {
  const holders = await db.select().from(s.tenderTanteo).where(and(eq(s.tenderTanteo.tenderId, t.id), eq(s.tenderTanteo.status, "holder")));
  if (!holders.length) return null;
  const totals = await totalsFor(db, t.id);
  const until = new Date(Date.now() + TANTEO_HOURS * 3600e3);
  const pending: { companyId: string; best: number }[] = [];

  for (const h of holders) {
    const mine = totals.find((x) => x.companyId === h.companyId);
    const others = totals.filter((x) => x.companyId !== h.companyId).map((x) => x.total);
    const best = others.length ? Math.min(...others) : null;
    const status: TanteoStatus = !mine ? "nobid" : best === null || mine.total <= best + 0.01 ? "best" : "pending";
    if (status === "pending") pending.push({ companyId: h.companyId, best: best! });
    await db
      .update(s.tenderTanteo)
      .set({ status, bestTotal: best, originalTotal: mine?.total ?? null, decidedAt: status === "pending" ? null : new Date() })
      .where(and(eq(s.tenderTanteo.tenderId, t.id), eq(s.tenderTanteo.companyId, h.companyId)));
  }
  if (!pending.length) return null;

  await db.update(s.tenders).set({ tanteoUntil: until }).where(eq(s.tenders.id, t.id));
  for (const p of pending) {
    await notify(
      db, [p.companyId], "tanteo_open",
      `${t.id} · ${t.title} ha cerrado y tienes derecho de tanteo. La mejor oferta es de ${eur(p.best)} sin IVA: puedes igualarla hasta el ${closeLabel(until.toISOString())}.`,
      `/industrial/paquetes/${t.id}`,
    );
  }
  return until;
}

/** Plazos de tanteo vencidos: los titulares que no respondieron lo pierden. */
export async function expireTanteo(db: DB) {
  const due = await db
    .select({ id: s.tenders.id, ownerId: s.tenders.ownerId })
    .from(s.tenders)
    .where(
      and(
        eq(s.tenders.status, "evaluacion"),
        lte(s.tenders.tanteoUntil, new Date()),
        sql`exists (select 1 from tender_tanteo tt where tt.tender_id = ${s.tenders.id} and tt.status = 'pending')`,
      ),
    );
  for (const t of due) {
    await db
      .update(s.tenderTanteo)
      .set({ status: "expired", decidedAt: new Date() })
      .where(and(eq(s.tenderTanteo.tenderId, t.id), eq(s.tenderTanteo.status, "pending")));
    await notify(db, [t.ownerId], "tanteo_ended", `Ha terminado el plazo de tanteo de ${t.id}. Ya puedes adjudicar.`, `/partidas/${t.id}`);
  }
}

/** ¿Queda algún titular con plazo para igualar? */
export async function tanteoActive(db: DB, tenderId: string, until: Date | null) {
  if (!until || until <= new Date()) return false;
  const [p] = await db
    .select({ n: sql<number>`count(*)`.mapWith(Number) })
    .from(s.tenderTanteo)
    .where(and(eq(s.tenderTanteo.tenderId, tenderId), eq(s.tenderTanteo.status, "pending")));
  return p.n > 0;
}

/** Paquetes (de la lista) con plazo de tanteo en curso. */
export async function activeTanteoIds(db: DB, tenderIds: string[]) {
  if (!tenderIds.length) return new Set<string>();
  const rows = await db
    .selectDistinct({ id: s.tenderTanteo.tenderId })
    .from(s.tenderTanteo)
    .innerJoin(s.tenders, eq(s.tenders.id, s.tenderTanteo.tenderId))
    .where(and(inArray(s.tenderTanteo.tenderId, tenderIds), eq(s.tenderTanteo.status, "pending"), sql`${s.tenders.tanteoUntil} > now()`));
  return new Set(rows.map((r) => r.id));
}

/** Titulares y plazo, para la promotora. */
export async function ownerTanteo(db: DB, tenderId: string, until: Date | null): Promise<TenderDetailDTO["tanteo"]> {
  const rows = await db
    .select({ r: s.tenderTanteo, name: s.companies.name })
    .from(s.tenderTanteo)
    .innerJoin(s.companies, eq(s.companies.id, s.tenderTanteo.companyId))
    .where(eq(s.tenderTanteo.tenderId, tenderId));
  if (!rows.length) return null;
  return {
    holders: rows.map(({ r, name }) => ({ id: r.companyId, name, status: r.status, original: r.originalTotal, best: r.bestTotal })),
    until: until?.toISOString() ?? null,
    active: await tanteoActive(db, tenderId, until),
  };
}

/** Para las tarjetas del industrial: qué paquetes tienen tanteo y mi situación en cada uno. */
export async function tanteoForIndustrial(db: DB, companyId: string, tenderIds: string[]) {
  const has = new Set<string>();
  const mine = new Map<string, { status: TanteoStatus; best: number | null }>();
  if (!tenderIds.length) return { has, mine };
  const rows = await db.select().from(s.tenderTanteo).where(inArray(s.tenderTanteo.tenderId, tenderIds));
  for (const r of rows) {
    has.add(r.tenderId);
    // El mejor importe solo se le muestra mientras puede igualarlo
    if (r.companyId === companyId) mine.set(r.tenderId, { status: r.status, best: r.status === "pending" || r.status === "matched" ? r.bestTotal : null });
  }
  return { has, mine };
}

/** Avisa a la promotora de la respuesta de un titular (y de si ya puede adjudicar). */
export async function afterTanteoAnswer(db: DB, t: { id: string; ownerId: string }, text: string) {
  const [p] = await db
    .select({ n: sql<number>`count(*)`.mapWith(Number) })
    .from(s.tenderTanteo)
    .where(and(eq(s.tenderTanteo.tenderId, t.id), eq(s.tenderTanteo.status, "pending")));
  const done = p.n === 0;
  await notify(db, [t.ownerId], done ? "tanteo_ended" : "tanteo_answer", text + (done ? " Todos los titulares han respondido: ya puedes adjudicar." : ""), `/partidas/${t.id}`);
}
