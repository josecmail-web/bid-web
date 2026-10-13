import * as XLSX from "xlsx";
import { SAMPLE } from "@/lib/catalog";
import { importRows, type Cell, type ImportResult } from "@/lib/import";
import { closeLabel } from "@/lib/format";
import { readPriceRows, type PriceImport } from "@/lib/prices";
import type { IndustrialTenderDTO, TenderItem } from "@/lib/types";

/**
 * En CSV, SheetJS interpretaría "1.800,00" o "34,9" con formato inglés (1,8 y 349): con raw
 * leemos el texto tal cual y lo interpretan nuestros parsers en formato español.
 */
async function readBook(file: File) {
  const buf = Buffer.from(await file.arrayBuffer());
  if (!/\.(csv|txt)$/i.test(file.name)) return XLSX.read(buf);
  // CSV: UTF-8 (lo habitual al guardar desde la web o Google Sheets) o Windows-1252 (Excel en español)
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(buf);
  } catch {
    text = new TextDecoder("windows-1252").decode(buf);
  }
  return XLSX.read(text.replace(/^\uFEFF/, ""), { type: "string", raw: true });
}

/** Lee la primera hoja de un .xlsx/.xls/.csv en el servidor y extrae las partidas. */
export async function parseMeasurements(file: File): Promise<ImportResult> {
  try {
    const wb = await readBook(file);
    const ws = wb.Sheets[wb.SheetNames[0]];
    const aoa = XLSX.utils.sheet_to_json<Cell[]>(ws, { header: 1, defval: "", raw: true });
    return importRows(aoa, file.name);
  } catch {
    return { ok: false, error: "No hemos podido leer " + file.name + ". Comprueba que sea un Excel válido." };
  }
}

/** Plantilla descargable: Código | Descripción | Ud | Medición, con filas de capítulo. */
export function templateWorkbook(): Buffer {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(SAMPLE), "Mediciones");
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

/* — hoja de presupuesto del industrial — */


const EUR_FMT = '#,##0.00 "€"';

/** Excel para presupuestar un paquete: partidas + columna de precio + fórmulas de importe y total. */
export function bidWorkbook(T: IndustrialTenderDTO): Buffer {
  const head: (string | number)[][] = [
    ["BID · Build Invest Direct — presupuesto por partidas"],
    ["Paquete", `${T.id} · ${T.title}`],
    ["Obra", `${T.obra} · ${T.loc}`],
    ["Promotora", T.owner],
    ["Cierre de la puja", closeLabel(T.closesAt)],
    ["Cómo usarlo", "Rellena la columna E en € sin IVA y súbelo en BID con «Subir Excel con precios». No cambies los códigos."],
    [],
    ["Código", "Descripción", "Ud", "Medición", "Precio unitario (€)", "Importe (€)"],
  ];
  const first = head.length + 1; // fila Excel (1-based) de la primera partida
  const ws = XLSX.utils.aoa_to_sheet(head);
  T.items.forEach((it, i) => {
    const r = first + i;
    const price = T.myPrices?.[i];
    XLSX.utils.sheet_add_aoa(ws, [[it.code, it.d, it.u, it.q]], { origin: `A${r}` });
    ws[`A${r}`] = { t: "s", v: it.code }; // el código siempre como texto ("01" no pasa a 1)
    ws[`D${r}`] = { t: "n", v: it.q, z: "#,##0.###" };
    if (price !== undefined) ws[`E${r}`] = { t: "n", v: price, z: EUR_FMT };
    else ws[`E${r}`] = { t: "z" };
    ws[`F${r}`] = { t: "n", f: `IF(E${r}="","",D${r}*E${r})`, z: EUR_FMT };
  });
  const last = first + T.items.length - 1;
  const tr = last + 1;
  XLSX.utils.sheet_add_aoa(ws, [["", "Total sin IVA"]], { origin: `A${tr}` });
  ws[`F${tr}`] = { t: "n", f: `SUM(F${first}:F${last})`, z: EUR_FMT };
  ws["!ref"] = `A1:F${tr}`;
  ws["!cols"] = [{ wch: 10 }, { wch: 60 }, { wch: 6 }, { wch: 12 }, { wch: 18 }, { wch: 16 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Presupuesto");
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

/** Lee una hoja de precios y la casa con las partidas del paquete. */
export async function readPriceSheet(file: File, items: TenderItem[]): Promise<PriceImport> {
  try {
    const wb = await readBook(file);
    const ws = wb.Sheets[wb.SheetNames[0]];
    const aoa = XLSX.utils.sheet_to_json<Cell[]>(ws, { header: 1, defval: "", raw: true });
    return readPriceRows(aoa, items, file.name);
  } catch {
    return { ok: false, error: "No hemos podido leer " + file.name + ". Comprueba que sea un Excel válido." };
  }
}
