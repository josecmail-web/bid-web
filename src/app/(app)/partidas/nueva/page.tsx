import { notFound } from "next/navigation";
import { requirePage } from "@/server/auth";
import { getDraft, getOwnerProjectNames } from "@/server/queries";
import { emptyWizard } from "@/lib/rules";
import { Wizard } from "./Wizard";

export default async function NuevaPage({ searchParams }: { searchParams: Promise<{ borrador?: string }> }) {
  const user = await requirePage("promotora");
  const { borrador } = await searchParams;
  const draft = borrador ? await getDraft(user.companyId!, borrador) : null;
  if (borrador && !draft) notFound();
  // key: al pasar de un borrador a "nuevo" el asistente se reinicia
  return <Wizard key={borrador ?? "new"} initial={draft ?? emptyWizard()} projects={await getOwnerProjectNames(user.companyId!)} />;
}
