import { getSession } from "@/server/auth";
import { getTenderForIndustrial } from "@/server/queries-industrial";
import { bidWorkbook } from "@/server/excel";

/** Excel para presupuestar un paquete (con mis precios si ya he pujado). Solo industriales con acceso. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSession();
  if (!user || user.role !== "industrial" || !user.companyId) return new Response("No autorizado", { status: 401 });
  const T = await getTenderForIndustrial(user.companyId, (await params).id);
  if (!T) return new Response("No encontrado", { status: 404 });
  return new Response(new Uint8Array(bidWorkbook(T)), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${T.id}-presupuesto.xlsx"`,
      "Cache-Control": "private, no-store",
    },
  });
}
