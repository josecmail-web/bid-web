import { norm, type Cell } from "./import";
import { parsePrice } from "./format";
import type { TenderItem } from "./types";

/**
 * Lectura de una hoja de precios (la plantilla que exporta Bidra, o la hoja propia del industrial
 * con columnas parecidas). Función pura: el servidor le pasa las filas ya leídas del Excel.
 */

export type PriceImport =
  | {
      ok: true;
      /** precio unitario por partida (null = no encontrado en la hoja) */
      prices: (number | null)[];
      matched: number;
      /** filas con un precio que no se pudo leer o no corresponde a ninguna partida */
      warnings: string[];
    }
  | { ok: false; error: string };

/** "01.02" ≈ "1.2" (Excel suele quitar ceros a la izquierda al reescribir códigos). */
const codeKey = (c: Cell) =>
  String(c ?? "")
    .trim()
    .toLowerCase()
    .split(/[.\-/ ]+/)
    .map((seg) => (/^\d+$/.test(seg) ? String(Number(seg)) : seg))
    .join(".");

function priceOf(c: Cell) {
  if (typeof c === "number") return c;
  return parsePrice(String(c ?? ""));
}

export function readPriceRows(aoa: Cell[][], items: TenderItem[], fileName: string): PriceImport {
  // Cabecera: la primera fila (de las 30 primeras) que tenga una columna de precio
  let hi = -1;
  let col = { price: -1, code: -1, desc: -1 };
  for (let i = 0; i < Math.min(aoa.length, 30); i++) {
    const cells = aoa[i].map((c) => norm(c).trim());
    // celdas cortas: una frase de instrucciones que mencione «precio» no es la cabecera
    const price = cells.findIndex((t) => t.length < 40 && /precio|p\.?\s?unit|€\s*\/|importe unit/.test(t));
    if (price < 0) continue;
    hi = i;
    col = {
      price,
      code: cells.findIndex((t) => /^(cod|n[o°º.]|num|ref)/.test(t)),
      desc: cells.findIndex((t) => /desc|concepto|resumen|partida|texto|denomin/.test(t)),
    };
    break;
  }
  if (hi < 0) return { ok: false, error: `No encontramos la columna «Precio unitario» en ${fileName}. Usa el Excel que descargas desde Bidra.` };

  const keys = items.map((it) => codeKey(it.code));
  const uniqueCodes = col.code >= 0 && new Set(keys).size === keys.length && keys.every(Boolean);
  const prices: (number | null)[] = items.map(() => null);
  const warnings: string[] = [];
  let seq = 0;

  for (let r = hi + 1; r < aoa.length; r++) {
    const row = aoa[r];
    const code = col.code >= 0 ? String(row[col.code] ?? "").trim() : "";
    const desc = col.desc >= 0 ? String(row[col.desc] ?? "").trim() : "";
    const raw = row[col.price];
    if (!code && !desc) continue;
    if (/^total/i.test(desc) || /^total/i.test(code)) continue;

    // Casar la fila con una partida: por código si son únicos; si no, por orden
    let idx = -1;
    if (uniqueCodes) idx = keys.indexOf(codeKey(code));
    else idx = seq < items.length ? seq : -1;
    seq++;

    const empty = raw === undefined || raw === null || String(raw).trim() === "";
    if (idx < 0) {
      if (!empty) warnings.push(`Fila ${r + 1}${code ? ` (${code})` : ""}: no corresponde a ninguna partida del paquete.`);
      continue;
    }
    if (empty) continue;
    const v = priceOf(raw);
    if (!Number.isFinite(v) || v <= 0 || v > 1e9) {
      warnings.push(`Fila ${r + 1} (${items[idx].code}): precio no válido «${String(raw)}».`);
      continue;
    }
    prices[idx] = Math.round(v * 100) / 100;
  }

  const matched = prices.filter((p) => p !== null).length;
  if (!matched) return { ok: false, error: `No hemos encontrado precios en ${fileName}. Rellena la columna «Precio unitario».` };
  return { ok: true, prices, matched, warnings: warnings.slice(0, 8) };
}
