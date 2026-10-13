import { notFound } from "next/navigation";
import { requirePage } from "@/server/auth";
import { getIndustrialProfile, getOwnCerts, getReceivedReviews } from "@/server/queries";
import { IndustrialProfile } from "./IndustrialProfile";
import { ReceivedReviews } from "./ReceivedReviews";

export default async function IndustrialPerfilPage() {
  const user = await requirePage("industrial");
  const me = await getIndustrialProfile(user.companyId!);
  if (!me) notFound();
  const [mine, reviews] = await Promise.all([getOwnCerts(user.companyId!), getReceivedReviews(user.companyId!)]);
  return (
    <div className="stack" style={{ gap: 30 }}>
      <IndustrialProfile me={me} mine={mine} />
      <ReceivedReviews reviews={reviews} />
    </div>
  );
}
