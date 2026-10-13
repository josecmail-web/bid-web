import { templateWorkbook } from "@/server/excel";

export function GET() {
  return new Response(new Uint8Array(templateWorkbook()), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="plantilla-partidas-bid.xlsx"',
    },
  });
}
