"use server";

import { and, eq, isNull } from "drizzle-orm";
import { getSession } from "../auth";
import { getDb, schema as s } from "../db";
import { getNotifications } from "../notifications";
import { safe, UserError } from "../action-utils";
import type { ActionResult, NotificationsDTO } from "@/lib/types";

async function companyOf() {
  const user = await getSession();
  if (!user?.companyId) throw new UserError("Inicia sesión.");
  return user.companyId;
}

export async function fetchNotifications(): Promise<ActionResult<{ data: NotificationsDTO }>> {
  return safe(async () => ({ ok: true, data: await getNotifications(await companyOf()) }));
}

export async function markNotificationRead(id: string): Promise<ActionResult> {
  return safe(async () => {
    const companyId = await companyOf();
    const db = await getDb();
    await db
      .update(s.notifications)
      .set({ readAt: new Date() })
      .where(and(eq(s.notifications.id, id), eq(s.notifications.companyId, companyId), isNull(s.notifications.readAt)));
    return { ok: true };
  });
}

export async function markAllNotificationsRead(): Promise<ActionResult> {
  return safe(async () => {
    const companyId = await companyOf();
    const db = await getDb();
    await db.update(s.notifications).set({ readAt: new Date() }).where(and(eq(s.notifications.companyId, companyId), isNull(s.notifications.readAt)));
    return { ok: true };
  });
}
