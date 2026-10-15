import { sql } from "drizzle-orm";
import { getDb } from "@/server/db";
import { ensureAdmin } from "@/server/bootstrap";

/** Comprobación de salud para la plataforma de despliegue. Conecta (y migra/siembra si hace falta). */
export async function GET() {
  try {
    const db = await getDb();
    await db.execute(sql`select 1`);
    await ensureAdmin().catch((e) => console.error("[bootstrap]", e));
    // versión desplegada (Railway la expone en RAILWAY_GIT_COMMIT_SHA): sirve para ver si ya está publicada
    return Response.json({ ok: true, version: process.env.RAILWAY_GIT_COMMIT_SHA?.slice(0, 7) ?? null });
  } catch (e) {
    console.error("[health]", e);
    return Response.json({ ok: false }, { status: 503 });
  }
}
