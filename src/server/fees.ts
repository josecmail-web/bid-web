import { eq, sql } from "drizzle-orm";
import { schema as s, type DB } from "./db";
import { PILOT, TARIFF, feeFor } from "../lib/pricing";

/** Importe total (sin IVA) de una puja: Σ precio unitario × medición. */
export async function bidTotal(db: DB, bidId: string) {
  const [r] = await db
    .select({ total: sql<number>`coalesce(sum(${s.bidItems.unitPrice} * ${s.tenderItems.quantity}), 0)`.mapWith(Number) })
    .from(s.bidItems)
    .innerJoin(s.tenderItems, eq(s.tenderItems.id, s.bidItems.tenderItemId))
    .where(eq(s.bidItems.bidId, bidId));
  return Math.round(r.total * 100) / 100;
}

/** Registra la comisión de una adjudicación (idempotente por paquete). En piloto, exenta. */
export async function recordAwardFee(db: DB, a: { tenderId: string; bidId: string; companyId: string; total: number }) {
  const fee = feeFor(a.total);
  await db
    .insert(s.awardFees)
    .values({
      tenderId: a.tenderId, bidId: a.bidId, companyId: a.companyId, awardedTotal: a.total, rate: TARIFF.rate,
      feeAmount: fee, chargedAmount: PILOT ? 0 : fee, status: PILOT ? "waived_pilot" : "pending", tariffVersion: TARIFF.version,
    })
    .onConflictDoNothing();
  return { fee, charged: PILOT ? 0 : fee };
}
