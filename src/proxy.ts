import { NextResponse, type NextRequest } from "next/server";

/**
 * Acceso a toda la web con una contraseña compartida (HTTP Basic) si SITE_PASSWORD está definida:
 * útil para la demo pública de las entrevistas. El usuario puede ser cualquiera.
 * En modo demo, además, se pide a los buscadores que no indexen nada.
 */
export function proxy(req: NextRequest) {
  const password = process.env.SITE_PASSWORD;
  if (password && req.nextUrl.pathname !== "/api/health") {
    const auth = req.headers.get("authorization") ?? "";
    let given = "";
    if (auth.startsWith("Basic ")) {
      try {
        given = atob(auth.slice(6)).split(":").slice(1).join(":");
      } catch {}
    }
    if (given !== password) {
      return new NextResponse("Acceso restringido", {
        status: 401,
        headers: { "WWW-Authenticate": 'Basic realm="BID", charset="UTF-8"', "X-Robots-Tag": "noindex, nofollow" },
      });
    }
  }
  const res = NextResponse.next();
  if (password || process.env.BID_DEMO === "1") res.headers.set("X-Robots-Tag", "noindex, nofollow");
  return res;
}

export const config = {
  // todo menos los estáticos de Next
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
