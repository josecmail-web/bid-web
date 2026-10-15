import { timingSafeEqual } from "node:crypto";
import { lt, or, sql } from "drizzle-orm";
import { getDb, schema as s } from "@/server/db";
import { closeExpired } from "@/server/queries";

/**
 * Tareas periódicas (llamar cada 5 min): cierra pujas vencidas y avisa a tiempo, abre y vence los
 * plazos de tanteo, y limpia intentos de acceso y enlaces caducados.
 *
 *   GET /api/cron   con la cabecera  Authorization: Bearer <CRON_SECRET>
 *
 * Sin CRON_SECRET definida, no existe (404). Ver .github/workflows/cron.yml.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return new Response("No encontrado", { status: 404 });
  const given = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  const a = Buffer.from(given), b = Buffer.from(secret);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return new Response("No autorizado", { status: 401 });

  const db = await getDb();
  await closeExpired(db);
  const month = new Date(Date.now() - 30 * 864e5);
  await db.delete(s.authAttempts).where(lt(s.authAttempts.createdAt, month));
  await db.delete(s.authTokens).where(or(lt(s.authTokens.expiresAt, month), sql`${s.authTokens.usedAt} < ${month}`));
  await db.delete(s.sessions).where(lt(s.sessions.expiresAt, new Date()));
  return Response.json({ ok: true, at: new Date().toISOString() });
}
