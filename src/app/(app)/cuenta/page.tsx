import { redirect } from "next/navigation";
import { getSession } from "@/server/auth";
import { getAccount } from "@/server/account";
import { AccountView } from "./AccountView";

export default async function CuentaPage() {
  const user = await getSession();
  if (!user) redirect("/login");
  return <AccountView data={await getAccount(user)} />;
}
