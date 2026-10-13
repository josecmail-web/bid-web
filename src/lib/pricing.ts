import { eur } from "./format";

/**
 * Tarifa de BID: comisión de éxito al industrial adjudicatario (ver producto.md › Monetización).
 * Durante el piloto la comisión se calcula y registra, pero no se cobra.
 */

export const TARIFF = {
  version: "2026-10",
  /** fracción del importe adjudicado sin IVA */
  rate: 0.01,
  min: 50,
  max: 1500,
} as const;

/** Piloto activo: no se cobra la comisión (se registra como "exenta"). */
export const PILOT = true;

/** Comisión que corresponde a un importe adjudicado (sin IVA), redondeada a céntimos. */
export function feeFor(awardedTotal: number) {
  if (!(awardedTotal > 0)) return 0;
  const raw = Math.min(Math.max(awardedTotal * TARIFF.rate, TARIFF.min), TARIFF.max, awardedTotal);
  return Math.round(raw * 100) / 100;
}

/** "1 % del importe adjudicado (mínimo 50 €, máximo 1.500 €)" */
export const TARIFF_TEXT = `${String(TARIFF.rate * 100).replace(".", ",")} % del importe adjudicado sin IVA (mínimo ${eur(TARIFF.min)}, máximo ${eur(TARIFF.max)})`;

/** Versión vigente de las condiciones de uso (src/app/condiciones). Cambiarla si cambian. */
export const TERMS_VERSION = "2026-10";
