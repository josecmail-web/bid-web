/**
 * Vacía la base de datos y la vuelve a sembrar con los datos de demo.
 * Uso: npm run db:seed   (con el servidor parado si se usa PGlite: no admite dos procesos a la vez)
 */
import { getDb } from "../src/server/db";
import { resetAndSeed } from "../src/server/db/seed";
import { schema } from "../src/server/db";
import { count } from "drizzle-orm";

async function main() {
  process.env.BID_DEMO = "0"; // evita el sembrado automático al conectar; lo hacemos explícito
  const db = await getDb();
  await resetAndSeed(db);
  const [c] = await db.select({ n: count() }).from(schema.companies);
  const [t] = await db.select({ n: count() }).from(schema.tenders);
  const [r] = await db.select({ n: count() }).from(schema.reviews);
  console.log(`Sembrado: ${c.n} empresas, ${t.n} paquetes, ${r.n} valoraciones.`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
