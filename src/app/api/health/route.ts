import { sql } from "drizzle-orm";
import { getDb } from "@/server/db";

/** Comprobación de salud para la plataforma de despliegue. Conecta (y migra/siembra si hace falta). */
export async function GET() {
  try {
    const db = await getDb();
    await db.execute(sql`select 1`);
    return Response.json({ ok: true });
  } catch (e) {
    console.error("[health]", e);
    return Response.json({ ok: false }, { status: 503 });
  }
}
