import type { Ratings } from "./types";

// es-ES no separa los miles en números de 4 cifras ("9500 €"); en importes queremos "9.500 €" siempre.
const G = { useGrouping: "always" } as unknown as Intl.NumberFormatOptions;
const EUR0 = new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 0, ...G });
const EUR2 = new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", minimumFractionDigits: 2, maximumFractionDigits: 2, ...G });
const NUM = new Intl.NumberFormat("es-ES", G);

export const eur = (n: number) => EUR0.format(n);
export const eur2 = (n: number) => EUR2.format(n);
export const num = (n: number) => NUM.format(n);
export const pad = (i: number) => String(i).padStart(2, "0");

export const avg = (r: number[]) => r.reduce((a, b) => a + b, 0) / r.length;
export const ratingOf = (r: Ratings | null) => (r ? avg(r) : 0);

/** 1 decimal with Spanish comma */
export const dec1 = (n: number) => n.toFixed(1).replace(".", ",");

export function stars(v: number) {
  const f = Math.round(v);
  return "★★★★★".slice(0, f) + "☆☆☆☆☆".slice(0, 5 - f);
}

/** "+4,3 %" / "-2,1 %" */
export function pct(ratio: number) {
  const v = (ratio - 1) * 100;
  return (v >= 0 ? "+" : "") + dec1(v) + " %";
}

/** Hora peninsular fija: el servidor y el navegador formatean igual (sin desajustes de hidratación). */
const TZ = "Europe/Madrid";

export function dateLabel(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric", timeZone: TZ }).replace(".", "");
}

export function closeLabel(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  return dateLabel(iso) + " · " + d.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit", timeZone: TZ });
}

export function daysTo(iso: string | null) {
  if (!iso) return "—";
  const n = Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 864e5));
  return n === 1 ? "1 día" : n + " días";
}

/** "YYYY-MM" → "MM/YYYY" */
export function expTxt(e: string) {
  if (!e) return "sin caducidad";
  const [y, m] = e.split("-");
  return m + "/" + y;
}

/** ≤ 3 months to expiry */
export function expiresSoon(e: string) {
  if (!e) return false;
  const [y, m] = e.split("-").map(Number);
  const n = new Date();
  return (y - n.getFullYear()) * 12 + (m - 1 - n.getMonth()) <= 3;
}

export function expired(e: string) {
  if (!e) return false;
  const [y, m] = e.split("-").map(Number);
  const n = new Date();
  return (y - n.getFullYear()) * 12 + (m - 1 - n.getMonth()) < 0;
}

export function plural(n: number, one: string, many: string) {
  return n === 1 ? one : many;
}

/** Cierra una frase con punto sin duplicarlo ("Turia S.L." no pasa a "S.L.."). */
export const dot = (s: string) => (s.endsWith(".") ? s : s + ".");

/** Precio escrito a mano en formato español: "1.240,50", "38,5", "38.5", "1240". NaN si no es válido. */
export function parsePrice(raw: string) {
  let s = raw.trim().replace(/\s|€/g, "");
  if (!s) return NaN;
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, ""); // "1.240" = mil doscientos cuarenta
  if (!/^\d+(\.\d+)?$/.test(s)) return NaN;
  return Number(s);
}

/** Número → texto editable con coma decimal y sin separador de miles. */
export const priceInput = (n: number) => n.toLocaleString("es-ES", { maximumFractionDigits: 2, useGrouping: false });

/** Valoración mínima: 4 → "4", 4.5 → "4,5" */
export const ratingMin = (n: number) => (Number.isInteger(n) ? String(n) : dec1(n));

/** "ahora", "hace 5 min", "hace 3 h", "ayer", "hace 4 días" o la fecha. */
export function ago(iso: string, now = Date.now()) {
  const m = Math.floor((now - new Date(iso).getTime()) / 60000);
  if (m < 1) return "ahora";
  if (m < 60) return `hace ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.floor(h / 24);
  if (d === 1) return "ayer";
  if (d < 7) return `hace ${d} días`;
  return dateLabel(iso);
}
