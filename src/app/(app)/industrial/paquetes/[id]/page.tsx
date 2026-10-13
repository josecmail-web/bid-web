import { notFound } from "next/navigation";
import { requirePage } from "@/server/auth";
import { getTenderForIndustrial } from "@/server/queries-industrial";
import { BidForm } from "./BidForm";

export default async function PaqueteIndustrialPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePage("industrial");
  // null también si no tiene acceso: no revelamos ni que existe
  const T = await getTenderForIndustrial(user.companyId!, (await params).id);
  if (!T) notFound();
  return <BidForm T={T} />;
}
