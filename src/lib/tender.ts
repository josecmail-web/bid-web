import { STATUS } from "./catalog";
import { closeLabel, dateLabel, daysTo, eur } from "./format";
import type { TenderCardDTO, TenderStatus } from "./types";

/** Métricas de la tarjeta del listado según estado. */
export function tenderSummary(t: TenderCardDTO) {
  const [statusLabel, tagClass] = STATUS[t.status];
  let k1 = "Partidas", v1 = String(t.itemCount), k2 = "Cierre", v2 = dateLabel(t.closesAt);
  if (t.status === "abierta") {
    k1 = "Sobres recibidos"; v1 = String(t.sealed); k2 = "Cierra en"; v2 = daysTo(t.closesAt);
  }
  if (t.status === "evaluacion") {
    k1 = "Pujas"; v1 = String(t.sealed); k2 = "Oferta más baja"; v2 = t.minTotal !== null ? eur(t.minTotal) : "—";
  }
  if (t.status === "adjudicada") {
    k1 = "Adjudicada a"; v1 = t.awardedName ? t.awardedName.split(" ").slice(0, 2).join(" ") : "—";
    k2 = "Importe"; v2 = t.awardedTotal !== null ? eur(t.awardedTotal) : "—";
  }
  return { statusLabel, tagClass, k1, v1, k2, v2 };
}

export function tenderCloseText(t: { status: TenderStatus; closesAt: string | null }) {
  return t.status === "abierta" ? closeLabel(t.closesAt) : dateLabel(t.closesAt);
}
