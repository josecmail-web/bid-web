import { requirePage } from "@/server/auth";
import { listOpenForIndustrial } from "@/server/queries-industrial";
import { PaquetesList } from "./PaquetesList";

export default async function PaquetesPage() {
  const user = await requirePage("industrial");
  return <PaquetesList tenders={await listOpenForIndustrial(user.companyId!)} companyName={user.companyName} />;
}
