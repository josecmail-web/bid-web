import { SECTORS } from "./catalog";
import type { SectorOrNone, WizardRow } from "./types";
import { pad } from "./format";

/** Importación de mediciones: detección de columnas + clasificación por sector.
 *  Funciones puras: el servidor las usa tras leer el Excel (src/server/excel.ts) y el cliente
 *  para el Excel de ejemplo y el alta manual de partidas. */

export type Cell = string | number | boolean | null | undefined;
type ColMap = { chap?: number; desc?: number; long?: number; qty?: number; unit?: number; code?: number; nat?: number };

export const norm = (t: Cell) =>
  String(t ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");

function bestMatch(t: string): SectorOrNone {
  let best: SectorOrNone = "";
  let pos = Infinity;
  for (const [name, kws] of SECTORS) {
    for (const k of kws) {
      const i = t.indexOf(k);
      if (i >= 0 && i < pos) {
        pos = i;
        best = name;
      }
    }
  }
  return best;
}

/** Busca primero en el capítulo y luego en la descripción. */
export function classify(chapter: string, desc: string): SectorOrNone {
  return bestMatch(norm(chapter) + " ") || bestMatch(norm(desc) + " ");
}

let pid = 0;
export function mkRow(d: string, u: string, q: number, chapter: string, code: string): WizardRow {
  pid += 1;
  return { id: Date.now() * 100 + pid, code, d, u: u || "ud", q: q || 0, sector: classify(chapter, d), on: true, chapter: chapter || undefined };
}

/** Números en formato español: 1.240,50 → 1240.5 */
export function toNum(x: Cell): number {
  if (typeof x === "number") return x;
  let s = String(x ?? "").trim().replace(/\s/g, "");
  if (!s) return 0;
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Detecta columnas por su cabecera. Cubre plantillas propias y exportaciones de Presto/Arquímedes/CYPE
 * ("Código | Nat | Ud | Resumen | CanPres"). Las columnas de código ("Cód. Partida", "Cód. Capítulo")
 * se separan primero para que no se confundan con la descripción o el capítulo.
 */
function headerMap(row: Cell[]): ColMap {
  const m: ColMap = {};
  // Las cabeceras son etiquetas cortas: así no confundimos con cabecera un texto del bloque de datos de
  // la obra ("Se debe cumplimentar la plantilla… por partidas") que suele ir encima de la tabla.
  const cells = row.map((c) => norm(c).trim()).map((t) => (t.length > 40 ? "" : t));
  const isCode = (t: string) => /^(cod|ref|n[o°º.]\s|num|id$)/.test(t);
  // Código: preferir el de la partida si hay varios ("Cód. Capítulo", "Cód. Partida")
  const codes = cells.map((t, i) => (t && isCode(t) ? i : -1)).filter((i) => i >= 0);
  m.code = codes.find((i) => /partida/.test(cells[i])) ?? codes.find((i) => !/capitulo|subcap/.test(cells[i])) ?? codes[0];
  cells.forEach((t, i) => {
    if (!t || codes.includes(i)) return;
    if (m.nat === undefined && /^nat(\.|uraleza)?$/.test(t)) m.nat = i;
    else if (m.chap === undefined && /^(capitulo|cap\.?)$/.test(t)) m.chap = i;
    else if (m.desc === undefined && /(desc|concepto|resumen|partida|texto|denomin)/.test(t)) m.desc = i;
    // Segunda columna de texto ("Resumen" + "Descripción"/"Texto"): la descripción larga
    else if (m.long === undefined && /(desc|texto|concepto)/.test(t)) m.long = i;
    else if (m.qty === undefined && /(medic|cantidad|^cant|^med|canpres|^can[\s.]|^uds?\.? ?totales)/.test(t)) m.qty = i;
    else if (m.unit === undefined && /^(ud|uds|un|unid|unidad)\b/.test(t)) m.unit = i;
  });
  return m;
}

function guessMap(rows: Cell[][]): ColMap {
  const sample = rows.slice(0, 40);
  const w = Math.max(...sample.map((r) => r.length));
  const stat = Array.from({ length: w }, (_, i) => {
    const vals = sample.map((r) => r[i]).filter((v) => String(v ?? "").trim() !== "");
    const n = vals.length || 1;
    return {
      i,
      num: vals.filter((v) => typeof v === "number" || /^[\d.,]+$/.test(String(v).trim())).length / n,
      len: vals.reduce<number>((a, v) => a + String(v).length, 0) / n,
      unit: vals.filter((v) => /^(ud|u|m|m2|m²|m3|m³|ml|kg|pa|h|t)\.?$/i.test(String(v).trim())).length / n,
    };
  });
  const m: ColMap = {};
  m.desc = stat.filter((s) => s.num < 0.5).sort((a, b) => b.len - a.len)[0]?.i;
  m.unit = stat.filter((s) => s.i !== m.desc && s.unit > 0.5)[0]?.i;
  m.qty = stat.filter((s) => s.i > (m.desc ?? -1) && s.num > 0.5)[0]?.i;
  if (m.desc !== 0) m.code = 0;
  return m;
}

export type ImportResult =
  | { ok: true; rows: WizardRow[]; note: string; sectors: number }
  | { ok: false; error: string };

export function importRows(aoa: Cell[][], name: string): ImportResult {
  const rows = aoa.filter((r) => r.some((c) => String(c ?? "").trim() !== ""));
  let hi = -1;
  let map: ColMap = {};
  for (let i = 0; i < Math.min(rows.length, 40); i++) {
    const m = headerMap(rows[i]);
    // Además de la descripción, una cabecera de verdad trae medición, unidad o código
    if (m.desc !== undefined && (m.qty !== undefined || m.unit !== undefined || m.code !== undefined)) {
      hi = i;
      map = m;
      break;
    }
  }
  if (hi < 0) map = guessMap(rows);
  if (map.desc === undefined) return { ok: false, error: "No encontramos una columna de descripción en " + name + "." };

  let chapter = "";
  let chapters = 0;
  let skipped = 0;
  const out: WizardRow[] = [];
  const seen = new Set<string>();
  const get = (r: Cell[], k: keyof ColMap) => (map[k] !== undefined ? String(r[map[k]!] ?? "").trim() : "");
  // Última partida leída: las filas sin código que la siguen son su descripción larga
  let prev: WizardRow | null = null;
  const addLong = (p: WizardRow, t: string) => {
    if (t === p.d) return;
    p.long = p.long ? p.long + "\n" + t : t;
  };
  for (const r of rows.slice(hi + 1)) {
    const d = get(r, "desc");
    const code = get(r, "code");
    const q = map.qty !== undefined ? toNum(r[map.qty]) : 0;
    const u = get(r, "unit");
    if (!d) {
      // Capítulo escrito en la columna de código ("05 - FÁBRICAS, TABIQUES…", "PRESUPUESTO PARCIAL Nº 4.- …")
      if (map.nat === undefined && !q && !u && /\p{L}{3}/u.test(code)) {
        chapter = code;
        chapters++;
        prev = null;
      } else if (prev && !code && get(r, "long")) addLong(prev, get(r, "long"));
      continue;
    }

    // Con columna de naturaleza (Presto): solo capítulos y partidas; se ignoran descompuestos
    // (mano de obra, material, maquinaria…) y las filas de texto largo sin naturaleza.
    if (map.nat !== undefined) {
      const nat = norm(get(r, "nat"));
      if (/^(cap|sub)/.test(nat)) {
        chapter = d;
        chapters++;
        continue;
      }
      if (!/^part/.test(nat)) {
        if (nat) skipped++;
        else if (!code && prev) addLong(prev, d);
        if (nat) prev = null;
        continue;
      }
    } else if (!q && !u) {
      // Sin medición ni unidad: título de capítulo… salvo que sea la descripción larga de la
      // partida anterior (sin código, y larga o justo debajo de una partida sin ir en mayúsculas).
      if (!code && (d.length > 90 || (prev && d !== d.toUpperCase()))) {
        if (prev) addLong(prev, d);
        continue;
      }
      chapter = d;
      chapters++;
      prev = null;
      continue;
    }

    // Desgloses que repiten la misma partida en varias filas (una por capa o tipo de trabajo)
    const key = [code, d, u, q].join("|");
    if (code && seen.has(key)) {
      prev = null;
      continue;
    }
    seen.add(key);

    prev = mkRow(d, u, q, get(r, "chap") || chapter, code || pad(out.length + 1));
    const long = get(r, "long");
    if (long) addLong(prev, long);
    out.push(prev);
  }
  if (!out.length) return { ok: false, error: "No hemos encontrado partidas en " + name + "." };

  const labels: [keyof ColMap, string][] = [["code", "código"], ["nat", "naturaleza"], ["desc", "descripción"], ["long", "descripción larga"], ["unit", "unidad"], ["qty", "medición"], ["chap", "capítulo"]];
  const found = labels.filter(([k]) => map[k] !== undefined).map((x) => x[1]);
  const withLong = out.filter((p) => p.long).length;
  if (map.long === undefined && withLong) found.push("descripción larga");
  const note =
    "Columnas detectadas: " + found.join(", ") +
    (chapters ? " · " + chapters + (chapters === 1 ? " capítulo" : " capítulos") : "") +
    (skipped ? " · " + skipped + " descompuestos ignorados" : "") +
    (map.qty === undefined ? " · sin columna de medición: complétala a mano" : "");
  return { ok: true, rows: out, note, sectors: new Set(out.map((p) => p.sector).filter(Boolean)).size };
}
