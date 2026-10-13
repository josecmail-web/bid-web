import { mkdirSync } from "node:fs";
import path from "node:path";
import type { PgliteDatabase } from "drizzle-orm/pglite";
import * as schema from "./schema";

/**
 * Conexión a la base de datos.
 * - Con DATABASE_URL: Postgres real (postgres-js).
 * - Sin ella: PGlite (Postgres embebido, WASM) en BID_DATA_DIR/pglite — cero instalación en local.
 * Las migraciones de ./drizzle se aplican al arrancar. En modo demo (BID_DEMO=1) se siembra
 * con datos de ejemplo si la BD está vacía.
 */

/** Ambos drivers exponen la misma API de Drizzle sobre el dialecto Postgres. */
export type DB = PgliteDatabase<typeof schema>;
export { schema };

export const isDemo = () => process.env.BID_DEMO === "1";
export const dataDir = () => path.resolve(/*turbopackIgnore: true*/ process.env.BID_DATA_DIR || ".data");

const g = globalThis as unknown as { __bidDb?: Promise<DB> };

export function getDb(): Promise<DB> {
  // Singleton por proceso (sobrevive al HMR de next dev)
  g.__bidDb ??= init().catch((e) => {
    g.__bidDb = undefined;
    throw e;
  });
  return g.__bidDb;
}

async function init(): Promise<DB> {
  const migrationsFolder = path.join(/*turbopackIgnore: true*/ process.cwd(), "drizzle");
  let db: DB;
  if (process.env.DATABASE_URL) {
    const { default: postgres } = await import("postgres");
    const { drizzle } = await import("drizzle-orm/postgres-js");
    const { migrate } = await import("drizzle-orm/postgres-js/migrator");
    const pg = drizzle({ client: postgres(process.env.DATABASE_URL, { max: 10 }), schema });
    await migrate(pg, { migrationsFolder });
    db = pg as unknown as DB;
  } else {
    const { PGlite } = await import("@electric-sql/pglite");
    const { drizzle } = await import("drizzle-orm/pglite");
    const { migrate } = await import("drizzle-orm/pglite/migrator");
    const dir = path.join(dataDir(), "pglite");
    mkdirSync(dir, { recursive: true });
    db = drizzle({ client: new PGlite(dir), schema });
    await migrate(db, { migrationsFolder });
  }
  if (isDemo()) {
    const [any] = await db.select({ id: schema.companies.id }).from(schema.companies).limit(1);
    if (!any) {
      const { seed } = await import("./seed");
      await seed(db);
    }
  }
  return db;
}
