import { notFound } from "next/navigation";
import { requirePage } from "@/server/auth";
import { getOwnerTender } from "@/server/queries";
import { TenderDetail } from "./TenderDetail";

export default async function TenderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePage("promotora");
  const T = await getOwnerTender(user.companyId!, (await params).id);
  if (!T) notFound();
  return <TenderDetail T={T} />;
}
