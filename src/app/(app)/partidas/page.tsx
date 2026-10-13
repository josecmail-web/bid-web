import { requirePage } from "@/server/auth";
import { listOwnerTenders } from "@/server/queries";
import { PartidasList } from "./PartidasList";

export default async function PartidasPage() {
  const user = await requirePage("promotora");
  return <PartidasList tenders={await listOwnerTenders(user.companyId!)} companyName={user.companyName} />;
}
