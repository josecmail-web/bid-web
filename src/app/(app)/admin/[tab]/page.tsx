import { notFound } from "next/navigation";
import { requirePage } from "@/server/auth";
import { getAdminData } from "@/server/queries";
import { ADMIN_TABS, type AdminTab } from "@/lib/routes";
import { AdminPanel } from "./AdminPanel";

export default async function AdminPage({ params }: { params: Promise<{ tab: string }> }) {
  await requirePage("admin");
  const { tab } = await params;
  if (!(ADMIN_TABS as readonly string[]).includes(tab)) notFound();
  return <AdminPanel data={await getAdminData()} tab={tab as AdminTab} />;
}
