import type { Metadata } from "next";
import { Barlow, Barlow_Condensed } from "next/font/google";
import { UIProvider } from "@/lib/store";
import "@/styles/industry.css";
import "@/styles/app.css";

const barlow = Barlow({ subsets: ["latin"], weight: ["400", "500", "700"], variable: "--font-b" });
const barlowCondensed = Barlow_Condensed({ subsets: ["latin"], weight: ["400", "600"], variable: "--font-bc" });

export const metadata: Metadata = {
  title: "Bidra Pro",
  description: "Partidas de obra a puja ciega entre promotoras e industriales verificados.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" className={`fonts ${barlow.variable} ${barlowCondensed.variable}`}>
      <body>
        <UIProvider>{children}</UIProvider>
      </body>
    </html>
  );
}
