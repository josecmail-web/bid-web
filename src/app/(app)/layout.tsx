import { redirect } from "next/navigation";
import { getSession } from "@/server/auth";
import { AppShell } from "@/components/AppShell";
import { getNotifications } from "@/server/notifications";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getSession();
  if (!user) redirect("/login");
  const notifications = user.companyId ? await getNotifications(user.companyId) : null;
  return (
    <AppShell
      user={{ role: user.role, email: user.email, companyName: user.companyName, verification: user.verification, demo: user.demo }}
      notifications={notifications}
    >
      {children}
    </AppShell>
  );
}
