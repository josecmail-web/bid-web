import type { Role } from "./types";

export function homeFor(role: Role) {
  return role === "admin" ? "/admin/verificaciones" : role === "industrial" ? "/industrial/paquetes" : "/partidas";
}

export const ADMIN_TABS = ["verificaciones", "certificados", "partidas", "valoraciones", "comisiones"] as const;
export type AdminTab = (typeof ADMIN_TABS)[number];
