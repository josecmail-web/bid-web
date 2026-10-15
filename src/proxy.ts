import { NextResponse, type NextRequest } from "next/server";

/**
 * Acceso a toda la web con una contraseña compartida (HTTP Basic) si SITE_PASSWORD está definida:
 * útil para la demo pública de las entrevistas. El usuario puede ser cualquiera.
 * En modo demo, además, se pide a los buscadores que no indexen nada.
 */
/**
 * Ficheros de la app instalable: el navegador los pide sin la contraseña (el manifest, por ejemplo,
 * se descarga sin credenciales), así que quedan fuera. No contienen datos.
 */
const PUBLIC = /^\/(api\/health|manifest\.webmanifest|sw\.js|offline\.html|icons\/[\w.-]+\.png|icon\.png|apple-icon\.png|bidra-(logo|mark)\.png)$/;

export function proxy(req: NextRequest) {
  const password = process.env.SITE_PASSWORD;
  if (password && !PUBLIC.test(req.nextUrl.pathname)) {
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
        headers: { "WWW-Authenticate": 'Basic realm="Bidra", charset="UTF-8"', "X-Robots-Tag": "noindex, nofollow" },
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
