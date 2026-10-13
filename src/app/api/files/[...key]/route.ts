import { getSession } from "@/server/auth";
import { canRead, getFile, MIME } from "@/server/storage";
import { industrialCanReadProjectFile } from "@/server/queries-industrial";

export async function GET(_req: Request, { params }: { params: Promise<{ key: string[] }> }) {
  const key = (await params).key.join("/");
  const user = await getSession();
  let allowed = canRead(key, user);
  // Adjuntos de obra: también para industriales que pueden ver algún paquete de esa obra
  if (!allowed && user?.role === "industrial" && user.companyId && key.startsWith("projects/"))
    allowed = await industrialCanReadProjectFile(user.companyId, key);
  if (!allowed) return new Response("No autorizado", { status: user ? 403 : 401 });
  const data = await getFile(key);
  if (!data) return new Response("No encontrado", { status: 404 });
  const ext = key.split(".").pop() ?? "";
  return new Response(new Uint8Array(data), {
    headers: {
      "Content-Type": MIME[ext] ?? "application/octet-stream",
      // Documentos privados: nunca en caché (otro usuario del mismo navegador no debe verlos)
      "Cache-Control": key.startsWith("logos/") ? "private, max-age=3600" : "private, no-store",
      "X-Content-Type-Options": "nosniff",
      // Los SVG subidos por usuarios no pueden ejecutar scripts
      "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; img-src data:; sandbox",
      "Content-Disposition": ext === "pdf" || ext === "png" || ext === "jpg" || ext === "jpeg" || ext === "svg" || ext === "webp" ? "inline" : "attachment",
    },
  });
}
