import { createHash, randomBytes } from "node:crypto";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { and, eq, gt, lt, ne } from "drizzle-orm";
import { getDb, isDemo, schema as s } from "./db";
import { homeFor } from "@/lib/routes";
import type { Role } from "@/lib/types";

const COOKIE = "bid_session";
const TTL_DAYS = 30;

const hashToken = (t: string) => createHash("sha256").update(t).digest("hex");

export interface SessionUser {
  userId: string;
  email: string;
  role: Role;
  companyId: string | null;
  companyName: string;
  verification: "pending" | "approved" | "rejected" | null;
  demo: boolean;
}

export async function createSession(userId: string) {
  const db = await getDb();
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + TTL_DAYS * 864e5);
  await db.insert(s.sessions).values({ id: hashToken(token), userId, expiresAt });
  await db.update(s.users).set({ lastLoginAt: new Date() }).where(eq(s.users.id, userId));
  // Limpieza oportunista de sesiones caducadas
  await db.delete(s.sessions).where(lt(s.sessions.expiresAt, new Date()));
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) {
    const db = await getDb();
    await db.delete(s.sessions).where(eq(s.sessions.id, hashToken(token)));
  }
  jar.delete(COOKIE);
}

/** Cierra todas las sesiones de un usuario salvo, opcionalmente, la de esta petición. */
export async function endSessions(userId: string, keepCurrent: boolean) {
  const db = await getDb();
  const token = keepCurrent ? (await cookies()).get(COOKIE)?.value : undefined;
  await db
    .delete(s.sessions)
    .where(and(eq(s.sessions.userId, userId), token ? ne(s.sessions.id, hashToken(token)) : undefined));
}

/** Usuario de la petición actual (memoizado por petición). */
export const getSession = cache(async (): Promise<SessionUser | null> => {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  const db = await getDb();
  const [row] = await db
    .select({
      userId: s.users.id,
      email: s.users.email,
      role: s.users.role,
      companyId: s.users.companyId,
      companyName: s.companies.name,
      verification: s.companies.verification,
    })
    .from(s.sessions)
    .innerJoin(s.users, eq(s.users.id, s.sessions.userId))
    .leftJoin(s.companies, eq(s.companies.id, s.users.companyId))
    .where(and(eq(s.sessions.id, hashToken(token)), gt(s.sessions.expiresAt, new Date())));
  if (!row) return null;
  return { ...row, companyName: row.companyName ?? "Equipo Bidra", demo: isDemo() };
});

/** Para páginas: redirige al login o a la home del rol si no corresponde. */
export async function requirePage(role: Role): Promise<SessionUser> {
  const user = await getSession();
  if (!user) redirect("/login");
  if (user.role !== role) redirect(homeFor(user.role));
  return user;
}

export class AuthError extends Error {}

/** Para Server Actions: lanza si no hay sesión o el rol no coincide. */
export async function requireAction(role: Role): Promise<SessionUser & { companyId: string }> {
  const user = await getSession();
  if (!user || user.role !== role) throw new AuthError("No autorizado.");
  if (role !== "admin" && !user.companyId) throw new AuthError("No autorizado.");
  return user as SessionUser & { companyId: string };
}
