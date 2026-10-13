import { and, asc, desc, eq, gt, isNull } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { getDb, schema as s } from "./db";
import type { SessionUser } from "./auth";
import type { AccountDTO } from "@/lib/types";

export async function getAccount(user: SessionUser & { userId: string }): Promise<AccountDTO> {
  const db = await getDb();
  if (!user.companyId) return { me: { email: user.email, role: user.role }, company: null, members: [], invites: [] };
  const [c] = await db.select().from(s.companies).where(eq(s.companies.id, user.companyId));
  const members = await db.select().from(s.users).where(eq(s.users.companyId, user.companyId)).orderBy(asc(s.users.createdAt));
  const creator = alias(s.users, "creator");
  const invites = await db
    .select({ t: s.authTokens, by: creator.email })
    .from(s.authTokens)
    .leftJoin(creator, eq(creator.id, s.authTokens.createdBy))
    .where(and(eq(s.authTokens.companyId, user.companyId), eq(s.authTokens.kind, "invite"), isNull(s.authTokens.usedAt), gt(s.authTokens.expiresAt, new Date())))
    .orderBy(desc(s.authTokens.createdAt));
  return {
    me: { email: user.email, role: user.role },
    company: { name: c.name, type: c.type, cif: c.cif, province: c.province, email: c.email, verification: c.verification, trades: c.trades },
    members: members.map((m) => ({
      id: m.id, email: m.email, isMe: m.id === user.userId,
      lastLoginAt: m.lastLoginAt?.toISOString() ?? null, createdAt: m.createdAt.toISOString(),
    })),
    invites: invites.map(({ t, by }) => ({ id: t.id, email: t.email, expiresAt: t.expiresAt.toISOString(), by })),
  };
}
