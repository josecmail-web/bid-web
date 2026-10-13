import { and, count, desc, eq, isNull } from "drizzle-orm";
import { getDb, schema as s } from "./db";
import type { NotificationsDTO } from "@/lib/types";

/** Últimos avisos de una empresa y nº de no leídos. */
export async function getNotifications(companyId: string, limit = 20): Promise<NotificationsDTO> {
  const db = await getDb();
  const rows = await db.select().from(s.notifications).where(eq(s.notifications.companyId, companyId)).orderBy(desc(s.notifications.createdAt)).limit(limit);
  const [u] = await db.select({ n: count() }).from(s.notifications).where(and(eq(s.notifications.companyId, companyId), isNull(s.notifications.readAt)));
  return {
    items: rows.map((n) => ({ id: n.id, kind: n.kind, message: n.message, link: n.link, createdAt: n.createdAt.toISOString(), read: !!n.readAt })),
    unread: u.n,
  };
}
