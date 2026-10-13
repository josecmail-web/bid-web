import { createHash, randomBytes } from "node:crypto";
import { headers } from "next/headers";
import { and, count, desc, eq, gt, isNull } from "drizzle-orm";
import { getDb, schema as s } from "./db";

/* — IP del cliente (detrás de un proxy, la primera de X-Forwarded-For) — */

export async function clientIp() {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0].trim() || h.get("x-real-ip") || "local";
}

/* — límite de intentos — */

const LIMITS = {
  // fallos de login por email (desde el último acceso correcto) y por IP, en 15 min
  login: { windowMin: 15, perEmail: 5, perIp: 30 },
  // peticiones de recuperación por email y por IP, en 1 h
  reset: { windowMin: 60, perEmail: 3, perIp: 10 },
} as const;

type Action = keyof typeof LIMITS;

/** Minutos de espera si se ha superado el límite (0 si puede intentarlo). */
export async function blockedFor(action: Action, email: string, ip: string): Promise<number> {
  const db = await getDb();
  const L = LIMITS[action];
  let since = new Date(Date.now() - L.windowMin * 60e3);
  if (action === "login") {
    // Un acceso correcto reinicia la cuenta de fallos de ese email
    const [ok] = await db
      .select({ at: s.authAttempts.createdAt })
      .from(s.authAttempts)
      .where(and(eq(s.authAttempts.action, "login"), eq(s.authAttempts.email, email), eq(s.authAttempts.success, true), gt(s.authAttempts.createdAt, since)))
      .orderBy(desc(s.authAttempts.createdAt))
      .limit(1);
    if (ok) since = ok.at;
  }
  const failsOnly = action === "login" ? eq(s.authAttempts.success, false) : undefined;
  const byEmail = await db
    .select({ n: count() })
    .from(s.authAttempts)
    .where(and(eq(s.authAttempts.action, action), eq(s.authAttempts.email, email), gt(s.authAttempts.createdAt, since), failsOnly));
  const [byIp] = await db
    .select({ n: count() })
    .from(s.authAttempts)
    .where(and(eq(s.authAttempts.action, action), eq(s.authAttempts.ip, ip), gt(s.authAttempts.createdAt, new Date(Date.now() - L.windowMin * 60e3)), failsOnly));
  if (byEmail[0].n < L.perEmail && byIp.n < L.perIp) return 0;
  // Espera hasta que el intento más antiguo de la ventana caduque (aprox.)
  const [oldest] = await db
    .select({ at: s.authAttempts.createdAt })
    .from(s.authAttempts)
    .where(and(eq(s.authAttempts.action, action), eq(s.authAttempts.email, email), gt(s.authAttempts.createdAt, since), failsOnly))
    .orderBy(s.authAttempts.createdAt)
    .limit(1);
  const until = (oldest?.at.getTime() ?? Date.now()) + L.windowMin * 60e3;
  return Math.max(1, Math.ceil((until - Date.now()) / 60e3));
}

export async function recordAttempt(action: Action, email: string, ip: string, success: boolean) {
  const db = await getDb();
  await db.insert(s.authAttempts).values({ action, email, ip, success });
}

/* — tokens de un solo uso (el enlace lleva el token; en BD solo su sha256) — */

const hash = (t: string) => createHash("sha256").update(t).digest("hex");

export async function createToken(input: {
  kind: "reset" | "invite";
  email: string;
  userId?: string | null;
  companyId?: string | null;
  createdBy?: string | null;
  hours: number;
}) {
  const db = await getDb();
  const token = randomBytes(32).toString("base64url");
  await db.insert(s.authTokens).values({
    id: hash(token), kind: input.kind, email: input.email, userId: input.userId ?? null, companyId: input.companyId ?? null,
    createdBy: input.createdBy ?? null, expiresAt: new Date(Date.now() + input.hours * 3600e3),
  });
  return token;
}

/** Token válido (sin usar y sin caducar) o null. No lo consume. */
export async function findToken(kind: "reset" | "invite", token: string) {
  if (!/^[A-Za-z0-9_-]{20,100}$/.test(token)) return null;
  const db = await getDb();
  const [t] = await db
    .select()
    .from(s.authTokens)
    .where(and(eq(s.authTokens.id, hash(token)), eq(s.authTokens.kind, kind), isNull(s.authTokens.usedAt), gt(s.authTokens.expiresAt, new Date())));
  return t ?? null;
}

/** Marca el token como usado; false si otro proceso se adelantó. */
export async function consumeToken(id: string) {
  const db = await getDb();
  const r = await db.update(s.authTokens).set({ usedAt: new Date() }).where(and(eq(s.authTokens.id, id), isNull(s.authTokens.usedAt))).returning({ id: s.authTokens.id });
  return r.length > 0;
}
