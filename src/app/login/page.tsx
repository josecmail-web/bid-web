import { redirect } from "next/navigation";
import { getSession } from "@/server/auth";
import { isDemo } from "@/server/db";
import { homeFor } from "@/lib/routes";
import { LoginForm } from "./LoginForm";

export default async function LoginPage() {
  const user = await getSession();
  if (user) redirect(homeFor(user.role));
  return <LoginForm demo={isDemo()} />;
}
