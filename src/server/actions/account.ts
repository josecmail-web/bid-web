"use server";

import { and, count, eq, isNull, ne } from "drizzle-orm";
import { refresh } from "next/cache";
import { createSession, endSessions, getSession } from "../auth";
import { getDb, schema as s } from "../db";
import { hashPassword, verifyPassword } from "../password";
import { consumeToken, createToken, findToken } from "../security";
import { appUrl, sendEmail } from "../mail";
import { safe, UserError } from "../action-utils";
import { EMAIL_RE, passwordError } from "@/lib/rules";
import { homeFor } from "@/lib/routes";
import { TERMS_VERSION } from "@/lib/pricing";
import type { ActionResult, Role } from "@/lib/types";

async function me() {
  const user = await getSession();
  if (!user) throw new UserError("Inicia sesión.");
  return user;
}

/** Cambia la contraseña (pide la actual) y cierra las demás sesiones abiertas. */
export async function changePassword(current: string, next: string): Promise<ActionResult> {
  return safe(async () => {
    const user = await me();
    const db = await getDb();
    const [u] = await db.select().from(s.users).where(eq(s.users.id, user.userId));
    if (!(await verifyPassword(String(current ?? ""), u.passwordHash))) throw new UserError("La contraseña actual no es correcta.");
    const err = passwordError(String(next ?? ""), u.email);
    if (err) throw new UserError(err);
    if (current === next) throw new UserError("La contraseña nueva debe ser distinta de la actual.");
    await db.update(s.users).set({ passwordHash: await hashPassword(next) }).where(eq(s.users.id, u.id));
    await endSessions(u.id, true);
    await sendEmail({
      to: u.email,
      subject: "Tu contraseña de Bidra ha cambiado",
      text: "Tu contraseña de Bidra se ha cambiado y hemos cerrado las demás sesiones abiertas.\n\nSi no has sido tú, recupera el acceso y avisa al equipo de Bidra.",
      action: { label: "Recuperar el acceso", url: await appUrl("/recuperar") },
    });
    return { ok: true };
  });
}

/** Invita a un compañero a la empresa (enlace válido 7 días). */
export async function inviteMember(emailRaw: string): Promise<ActionResult<{ email: string }>> {
  return safe(async () => {
    const user = await me();
    if (!user.companyId) throw new UserError("Solo las empresas pueden invitar a su equipo.");
    const email = String(emailRaw ?? "").trim().toLowerCase().slice(0, 200);
    if (!EMAIL_RE.test(email)) throw new UserError("Introduce un email válido.");
    const db = await getDb();
    const [exists] = await db.select({ id: s.users.id }).from(s.users).where(eq(s.users.email, email));
    if (exists) throw new UserError("Ese email ya tiene una cuenta en Bidra.");
    const [pendingN] = await db
      .select({ n: count() })
      .from(s.authTokens)
      .where(and(eq(s.authTokens.companyId, user.companyId), eq(s.authTokens.kind, "invite"), isNull(s.authTokens.usedAt)));
    if (pendingN.n >= 20) throw new UserError("Tienes demasiadas invitaciones pendientes. Cancela alguna antes de enviar más.");
    // Una invitación viva por email y empresa
    await db
      .update(s.authTokens)
      .set({ usedAt: new Date() })
      .where(and(eq(s.authTokens.companyId, user.companyId), eq(s.authTokens.email, email), eq(s.authTokens.kind, "invite"), isNull(s.authTokens.usedAt)));
    const token = await createToken({ kind: "invite", email, companyId: user.companyId, createdBy: user.userId, hours: 24 * 7 });
    await sendEmail({
      to: email,
      subject: `${user.companyName} te invita a su equipo en Bidra`,
      text: `${user.email} te ha invitado a unirte a ${user.companyName} en Bidra, la plataforma de partidas de obra a puja ciega.\n\nLa invitación caduca en 7 días.`,
      action: { label: "Crear mi acceso", url: await appUrl("/invitacion/" + token) },
    });
    refresh();
    return { ok: true, email };
  });
}

export async function cancelInvite(inviteId: string): Promise<ActionResult> {
  return safe(async () => {
    const user = await me();
    const db = await getDb();
    await db
      .update(s.authTokens)
      .set({ usedAt: new Date() })
      .where(and(eq(s.authTokens.id, inviteId), eq(s.authTokens.companyId, user.companyId ?? ""), eq(s.authTokens.kind, "invite"), isNull(s.authTokens.usedAt)));
    refresh();
    return { ok: true };
  });
}

/** Quita a un compañero del equipo (no a uno mismo). Sus sesiones se cierran al borrarlo. */
export async function removeMember(userId: string): Promise<ActionResult<{ email: string }>> {
  return safe(async () => {
    const user = await me();
    if (!user.companyId) throw new UserError("No autorizado.");
    if (userId === user.userId) throw new UserError("No puedes quitarte a ti mismo.");
    const db = await getDb();
    const removed = await db
      .delete(s.users)
      .where(and(eq(s.users.id, userId), eq(s.users.companyId, user.companyId), ne(s.users.id, user.userId)))
      .returning({ email: s.users.email });
    if (!removed.length) throw new UserError("Ese usuario no pertenece a tu empresa.");
    refresh();
    return { ok: true, email: removed[0].email };
  });
}

/** Acepta una invitación: crea el usuario en la empresa e inicia sesión. */
export async function acceptInvite(token: string, password: string, acceptedTerms: boolean): Promise<ActionResult<{ home: string }>> {
  return safe(async () => {
    if (!acceptedTerms) throw new UserError("Acepta las condiciones de uso para continuar.");
    const t = await findToken("invite", token);
    if (!t?.companyId) throw new UserError("La invitación no es válida o ha caducado. Pide una nueva.");
    const err = passwordError(String(password ?? ""), t.email);
    if (err) throw new UserError(err);
    const db = await getDb();
    const [c] = await db.select({ type: s.companies.type }).from(s.companies).where(eq(s.companies.id, t.companyId));
    if (!c) throw new UserError("La empresa ya no existe.");
    const [exists] = await db.select({ id: s.users.id }).from(s.users).where(eq(s.users.email, t.email));
    if (exists) throw new UserError("Ese email ya tiene una cuenta en Bidra. Inicia sesión.");
    if (!(await consumeToken(t.id))) throw new UserError("La invitación ya se ha usado.");
    const role: Role = c.type;
    const [u] = await db
      .insert(s.users)
      .values({ email: t.email, passwordHash: await hashPassword(password), role, companyId: t.companyId, termsVersion: TERMS_VERSION, termsAcceptedAt: new Date() })
      .returning({ id: s.users.id });
    await createSession(u.id);
    return { ok: true, home: homeFor(role) };
  });
}
