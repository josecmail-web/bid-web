import { randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { getDb, schema as s } from "./db";
import { hashPassword } from "./password";
import { createToken } from "./security";
import { appUrl, sendEmail } from "./mail";
import { EMAIL_RE } from "@/lib/rules";

let done = false;

/**
 * Primer administrador en producción: con ADMIN_EMAIL definida y sin usuario con ese email, crea la
 * cuenta de administración (sin contraseña utilizable) y le envía un enlace para elegirla (72 h).
 * Se ejecuta una vez por proceso, desde /api/health (Railway lo llama en cada despliegue).
 */
export async function ensureAdmin() {
  if (done) return;
  done = true;
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  if (!email || !EMAIL_RE.test(email)) return;
  const db = await getDb();
  const [u] = await db.select({ id: s.users.id }).from(s.users).where(eq(s.users.email, email));
  if (u) return;
  const [admin] = await db
    .insert(s.users)
    .values({ email, role: "admin", passwordHash: await hashPassword(randomBytes(32).toString("base64url")) })
    .onConflictDoNothing()
    .returning({ id: s.users.id });
  if (!admin) return;
  const token = await createToken({ kind: "reset", email, userId: admin.id, hours: 72 });
  await sendEmail({
    to: email,
    subject: "Tu cuenta de administración de Bidra",
    text: "Se ha creado la cuenta de administración de Bidra para este email.\n\nElige tu contraseña con el enlace (caduca en 72 horas). Si caduca, usa «¿Has olvidado tu contraseña?» en la pantalla de acceso.",
    action: { label: "Elegir contraseña", url: await appUrl("/restablecer/" + token) },
  });
  console.info(`[bootstrap] Cuenta de administración creada para ${email}.`);
}
