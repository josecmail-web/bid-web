import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // PGlite carga ficheros WASM en tiempo de ejecución: no empaquetar.
  serverExternalPackages: ["@electric-sql/pglite"],
  // Cabeceras de seguridad para todas las rutas. (CSP estricta pendiente: Next usa scripts inline.)
  async headers() {
    return [
      // El service worker siempre se revisa (para que las versiones nuevas lleguen enseguida)
      { source: "/sw.js", headers: [{ key: "Cache-Control", value: "no-cache" }] },
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
          ...(process.env.NODE_ENV === "production" ? [{ key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" }] : []),
        ],
      },
    ];
  },
  poweredByHeader: false,
  experimental: {
    // Subidas de PDF/logos/Excel por Server Actions (límite por fichero: 10 MB, ver src/server/storage.ts)
    serverActions: { bodySizeLimit: "12mb" },
  },
};

export default nextConfig;
