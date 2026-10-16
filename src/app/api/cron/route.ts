import { timingSafeEqual } from "node:crypto";
import { lt, or } from "drizzle-orm";
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
  const month = new Date(Date.now() - 30 * 864e5);
  // Cada tarea por separado: un fallo en la limpieza no puede impedir que se cierren las pujas
  const tasks: [string, () => Promise<unknown>][] = [
    ["cierres y tanteo", () => closeExpired(db)],
    ["intentos de acceso", () => db.delete(s.authAttempts).where(lt(s.authAttempts.createdAt, month))],
    // Fechas siempre con lt()/gt() de Drizzle: en sql`` a mano, Postgres (postgres-js) no acepta un Date
    ["enlaces caducados", () => db.delete(s.authTokens).where(or(lt(s.authTokens.expiresAt, month), lt(s.authTokens.usedAt, month)))],
    ["sesiones caducadas", () => db.delete(s.sessions).where(lt(s.sessions.expiresAt, new Date()))],
  ];
  const failed: string[] = [];
  for (const [name, run] of tasks) {
    try {
      await run();
    } catch (e) {
      console.error(`[cron] ${name}:`, e);
      failed.push(name);
    }
  }
  return Response.json({ ok: !failed.length, failed, at: new Date().toISOString() }, { status: failed.length ? 500 : 200 });
}
