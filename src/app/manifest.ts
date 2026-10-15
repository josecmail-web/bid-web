import type { MetadataRoute } from "next";

/** App instalable (PWA): «Añadir a pantalla de inicio» en iPhone y «Instalar app» en Android. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Bidra Pro",
    short_name: "Bidra",
    description: "Partidas de obra a puja ciega entre promotoras e industriales verificados.",
    id: "/",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f2f2f3",
    theme_color: "#f2f2f3",
    lang: "es",
    categories: ["business", "productivity"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
