import { redirect } from "next/navigation";
import { getSession } from "@/server/auth";
import { homeFor } from "@/lib/routes";

export default async function Home() {
  const user = await getSession();
  redirect(user ? homeFor(user.role) : "/login");
}
