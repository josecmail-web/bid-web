import { requirePage } from "@/server/auth";
import { listMyBids } from "@/server/queries-industrial";
import { MisPujas } from "./MisPujas";

export default async function MisPujasPage() {
  const user = await requirePage("industrial");
  return <MisPujas bids={await listMyBids(user.companyId!)} companyName={user.companyName} />;
}
