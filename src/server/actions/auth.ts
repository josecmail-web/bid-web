"use server";

import { and, eq, isNull } from "drizzle-orm";
import { refresh } from "next/cache";
import { createSession, destroySession, endSessions } from "../auth";
import { blockedFor, clientIp, consumeToken, createToken, findToken, recordAttempt } from "../security";
import { appUrl, sendEmail } from "../mail";
import { getDb, isDemo, schema as s } from "../db";
import { hashPassword, verifyPassword } from "../password";
import { isFile, putFile } from "../storage";
import { safe, str, UserError } from "../action-utils";
import { PROVINCES, TRADES } from "@/lib/catalog";
import { EMAIL_RE, passwordError, requiredDocs } from "@/lib/rules";
import { validateTaxId } from "@/lib/taxid";
import { TERMS_VERSION } from "@/lib/pricing";
import { homeFor } from "@/lib/routes";
import { DEMO_USERS } from "../db/seed-data";
import type { ActionResult, Role } from "@/lib/types";

export async function login(emailRaw: string, password: string): Promise<ActionResult<{ home: string }>> {
  return safe(async () => {
    const email = String(emailRaw ?? "").trim().toLowerCase().slice(0, 200);
    const ip = await clientIp();
    const wait = await blockedFor("login", email, ip);
    if (wait) throw new UserError(`Demasiados intentos fallidos. Vuelve a intentarlo en ${wait} min o recupera tu contraseña.`);
    const db = await getDb();
    const [u] = await db.select().from(s.users).where(eq(s.users.email, email));
    // Mismo mensaje exista o no el usuario; verificamos siempre para no delatarlo por el tiempo de respuesta
    const ok = u ? await verifyPassword(String(password ?? ""), u.passwordHash) : (await hashPassword("x"), false);
    await recordAttempt("login", email, ip, ok);
    if (!u || !ok) throw new UserError("Email o contraseña incorrectos.");
    await createSession(u.id);
    return { ok: true, home: homeFor(u.role) };
  });
}

/** Envía un enlace para restablecer la contraseña. La respuesta es la misma exista o no la cuenta. */
export async function requestPasswordReset(emailRaw: string): Promise<ActionResult> {
  return safe(async () => {
    const email = String(emailRaw ?? "").trim().toLowerCase().slice(0, 200);
    if (!EMAIL_RE.test(email)) throw new UserError("Introduce un email válido.");
    const ip = await clientIp();
    if (await blockedFor("reset", email, ip)) return { ok: true }; // en silencio
    await recordAttempt("reset", email, ip, true);
    const db = await getDb();
    const [u] = await db.select().from(s.users).where(eq(s.users.email, email));
    if (u) {
      // Solo vale el último enlace pedido
      await db.update(s.authTokens).set({ usedAt: new Date() }).where(and(eq(s.authTokens.userId, u.id), eq(s.authTokens.kind, "reset"), isNull(s.authTokens.usedAt)));
      const token = await createToken({ kind: "reset", email, userId: u.id, hours: 1 });
      await sendEmail({
        to: email,
        subject: "Restablece tu contraseña de BID",
        text: "Hemos recibido una petición para cambiar la contraseña de tu cuenta de BID.\n\nEl enlace caduca en 1 hora y solo sirve una vez. Si no lo has pedido tú, ignora este email: tu contraseña no cambia.",
        action: { label: "Elegir contraseña nueva", url: await appUrl("/restablecer/" + token) },
      });
    }
    return { ok: true };
  });
}

/** Fija una contraseña nueva con un enlace de recuperación y cierra todas las sesiones abiertas. */
export async function resetPassword(token: string, password: string): Promise<ActionResult> {
  return safe(async () => {
    const t = await findToken("reset", token);
    if (!t?.userId) throw new UserError("El enlace no es válido o ha caducado. Pide uno nuevo.");
    const err = passwordError(String(password ?? ""), t.email);
    if (err) throw new UserError(err);
    if (!(await consumeToken(t.id))) throw new UserError("El enlace ya se ha usado. Pide uno nuevo.");
    const db = await getDb();
    await db.update(s.users).set({ passwordHash: await hashPassword(password) }).where(eq(s.users.id, t.userId));
    await endSessions(t.userId, false);
    await sendEmail({
      to: t.email,
      subject: "Tu contraseña de BID ha cambiado",
      text: "Tu contraseña de BID se ha cambiado y hemos cerrado todas las sesiones abiertas.\n\nSi no has sido tú, recupera el acceso y avisa al equipo de BID.",
      action: { label: "Entrar en BID", url: await appUrl("/login") },
    });
    return { ok: true };
  });
}

export async function logout(): Promise<ActionResult> {
  return safe(async () => {
    await destroySession();
    return { ok: true };
  });
}

const KINDS = ["Promotora", "Constructora", "Ambas"];
const VOLUMES = ["< 5 M€", "5–20 M€", "20–50 M€", "> 50 M€"];
const RADII = ["Provincia", "Comunidad", "Nacional"];

/** Alta de empresa: crea la empresa (pendiente de verificación), el usuario y los documentos, e inicia sesión. */
export async function register(fd: FormData): Promise<ActionResult<{ home: string }>> {
  return safe(async () => {
    const type = str(fd.get("type"));
    if (type !== "promotora" && type !== "industrial") throw new UserError("Elige un tipo de cuenta.");
    const name = str(fd.get("name"));
    const cifRaw = str(fd.get("cif"));
    const prov = str(fd.get("prov"));
    const email = str(fd.get("email")).toLowerCase();
    const pass = typeof fd.get("pass") === "string" ? (fd.get("pass") as string) : "";
    if (!name) throw new UserError("Indica la razón social.");
    const tax = validateTaxId(cifRaw);
    if (!tax.ok) throw new UserError(tax.error);
    const cif = tax.value;
    if (!PROVINCES.includes(prov)) throw new UserError("Elige una provincia.");
    if (!EMAIL_RE.test(email)) throw new UserError("Introduce un email válido.");
    const pwErr = passwordError(pass, email);
    if (pwErr) throw new UserError(pwErr);

    let trades: string[] = [];
    if (type === "industrial") {
      try {
        trades = (JSON.parse(str(fd.get("trades")) || "[]") as string[]).filter((t) => (TRADES as string[]).includes(t));
      } catch {}
      if (!trades.length) throw new UserError("Selecciona al menos un oficio.");
    }
    const kind = KINDS.includes(str(fd.get("kind"))) ? str(fd.get("kind")) : "Promotora";
    const vol = VOLUMES.includes(str(fd.get("vol"))) ? str(fd.get("vol")) : null;
    const radius = RADII.includes(str(fd.get("radius"))) ? str(fd.get("radius")) : "Provincia";

    if (str(fd.get("terms")) !== "1") throw new UserError("Acepta las condiciones de uso para continuar.");
    const docs = requiredDocs(type).map(([k]) => [k, fd.get("doc:" + k)] as const);
    if (docs.some(([, f]) => !isFile(f))) throw new UserError("Faltan documentos por subir.");

    const db = await getDb();
    const [dupUser] = await db.select({ id: s.users.id }).from(s.users).where(eq(s.users.email, email));
    if (dupUser) throw new UserError("Ya existe una cuenta con ese email.");
    const [dupCif] = await db.select({ id: s.companies.id }).from(s.companies).where(eq(s.companies.cif, cif));
    if (dupCif) throw new UserError("Ya hay una empresa registrada con ese CIF.");

    const passwordHash = await hashPassword(pass);
    const userId = await db.transaction(async (tx) => {
      const [c] = await tx
        .insert(s.companies)
        .values({
          type, name, cif, province: prov, email,
          kind: type === "promotora" ? kind : null, annualVolume: type === "promotora" ? vol : null,
          trades, radius: type === "industrial" ? radius : null, verification: "pending",
        })
        .returning({ id: s.companies.id });
      for (const [kindDoc, f] of docs) {
        const file = f as File;
        await tx.insert(s.companyDocs).values({ companyId: c.id, kind: kindDoc, fileKey: await putFile("docs", c.id, file), fileName: file.name });
      }
      const [u] = await tx
        .insert(s.users)
        .values({ email, passwordHash, role: type, companyId: c.id, termsVersion: TERMS_VERSION, termsAcceptedAt: new Date() })
        .returning({ id: s.users.id });
      return u.id;
    });
    await createSession(userId);
    return { ok: true, home: homeFor(type) };
  });
}

/* — solo modo demo — */

export async function demoLogin(role: Role): Promise<ActionResult<{ home: string }>> {
  return safe(async () => {
    if (!isDemo()) throw new UserError("No disponible.");
    const db = await getDb();
    const [u] = await db.select().from(s.users).where(eq(s.users.email, DEMO_USERS[role].email));
    if (!u) throw new UserError("Usuario de demo no encontrado. Restablece los datos de demo.");
    await createSession(u.id);
    refresh();
    return { ok: true, home: homeFor(role) };
  });
}

export async function resetDemo(): Promise<ActionResult> {
  return safe(async () => {
    if (!isDemo()) throw new UserError("No disponible.");
    const { resetAndSeed } = await import("../db/seed");
    await resetAndSeed(await getDb());
    await destroySession();
    return { ok: true };
  });
}
