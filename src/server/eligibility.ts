import { and, eq, gte, inArray, sql } from "drizzle-orm";
import { schema as s, type DB } from "./db";
import { currentYM, ratingsFor } from "./queries";

/**
 * Un industrial puede ver y pujar un paquete si: está verificado, trabaja el sector, tiene todos los
 * certificados exigidos validados y vigentes, y cumple la valoración mínima (sin valoraciones = no cumple
 * si se exige mínimo). TODO: radio de trabajo (provincia/comunidad) y paquetes por invitación.
 */
export async function eligibleIndustrials(db: DB, sector: string, req: string[], minRating: number | null, onlyIds?: string[]) {
  const cands = await db
    .select({ id: s.companies.id })
    .from(s.companies)
    .where(
      and(
        eq(s.companies.type, "industrial"),
        eq(s.companies.verification, "approved"),
        sql`${s.companies.trades} @> ${JSON.stringify([sector])}::jsonb`,
        onlyIds ? inArray(s.companies.id, onlyIds) : undefined,
      ),
    );
  const ids = cands.map((c) => c.id);
  if (!ids.length) return [];
  const certs = await db
    .select({ companyId: s.certificates.companyId, type: s.certificates.certType })
    .from(s.certificates)
    .where(and(inArray(s.certificates.companyId, ids), eq(s.certificates.status, "ok"), gte(s.certificates.expiresAt, currentYM())));
  const ratings = minRating ? await ratingsFor(db, ids) : null;
  return ids.filter((id) => {
    const has = new Set(certs.filter((c) => c.companyId === id).map((c) => c.type));
    if (!req.every((r) => has.has(r))) return false;
    if (minRating && ratings) {
      const r = ratings.get(id)?.r;
      if (!r || (r[0] + r[1] + r[2] + r[3]) / 4 < minRating) return false;
    }
    return true;
  });
}
