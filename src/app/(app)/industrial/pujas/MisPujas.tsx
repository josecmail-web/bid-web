"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { dateLabel, daysTo, eur } from "@/lib/format";
import type { IndustrialTenderCardDTO } from "@/lib/types";
import { Blueprint } from "@/components/ui";

type Filter = "todas" | "abiertas" | "evaluacion" | "ganadas" | "perdidas";

function state(t: IndustrialTenderCardDTO): [string, string] {
  if (t.result === "won") return ["Adjudicada", "tag tag-accent"];
  if (t.result === "lost") return ["No adjudicada", "tag tag-neutral"];
  if (t.status === "evaluacion" && t.myTanteo?.status === "pending" && t.myTanteo.until && new Date(t.myTanteo.until) > new Date())
    return ["Tanteo: puedes igualar", "tag tag-accent"];
  if (t.status === "evaluacion") return ["En evaluación", "tag tag-outline"];
  return ["Abierta · editable", "tag tag-outline"];
}

export function MisPujas({ bids, companyName }: { bids: IndustrialTenderCardDTO[]; companyName: string }) {
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>("todas");
  const groups: Record<Filter, IndustrialTenderCardDTO[]> = {
    todas: bids,
    abiertas: bids.filter((b) => b.status === "abierta"),
    evaluacion: bids.filter((b) => b.status === "evaluacion"),
    ganadas: bids.filter((b) => b.result === "won"),
    perdidas: bids.filter((b) => b.result === "lost"),
  };
  const FILTERS: [Filter, string][] = [["todas", "Todas"], ["abiertas", "Abiertas"], ["evaluacion", "En evaluación"], ["ganadas", "Adjudicadas"], ["perdidas", "No adjudicadas"]];
  const decided = groups.ganadas.length + groups.perdidas.length;
  const won = groups.ganadas.reduce((a, b) => a + (b.myBid?.total ?? 0), 0);
  const shown = groups[filter];

  return (
    <div className="stack" style={{ gap: 22 }}>
      <div>
        <div className="kicker">{companyName}</div>
        <h1 style={{ marginTop: 2 }}>Mis pujas</h1>
      </div>

      <Blueprint className="facts" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))" }}>
        {(
          [
            ["Pujas enviadas", String(bids.length)],
            ["Abiertas", String(groups.abiertas.length)],
            ["Adjudicadas", decided ? `${groups.ganadas.length} de ${decided}` : "—"],
            ["Importe adjudicado", won ? eur(won) : "—"],
          ] as [string, string][]
        ).map(([k, v]) => (
          <div key={k} className="fact">
            <div className="label">{k}</div>
            <div className="figure" style={{ fontSize: 26 }}>{v}</div>
          </div>
        ))}
      </Blueprint>

      <div style={{ display: "flex", overflowX: "auto" }}>
        <div className="segbar sm nowrap" role="group" aria-label="Filtrar pujas">
          {FILTERS.map(([k, l]) => (
            <button key={k} type="button" aria-pressed={k === filter} onClick={() => setFilter(k)}>
              {l} · {groups[k].length}
            </button>
          ))}
        </div>
      </div>

      {shown.length > 0 && (
        <div className="scroll-x">
          <table className="table" style={{ minWidth: 820 }}>
            <thead>
              <tr>
                <th>ID</th><th>Trabajo</th><th>Promotora</th><th>Estado</th><th className="r">Mi oferta</th><th>Cierre</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((t) => {
                const [label, cls] = state(t);
                return (
                  <tr key={t.id} style={{ cursor: "pointer" }} onClick={() => router.push("/industrial/paquetes/" + t.id)}>
                    <td style={{ font: "500 12px ui-monospace,Menlo,monospace" }}>
                      <Link href={"/industrial/paquetes/" + t.id} style={{ color: "inherit" }} onClick={(e) => e.stopPropagation()}>{t.id}</Link>
                    </td>
                    <td>
                      <div>{t.title}</div>
                      <div className="xs muted">{t.obra} · {t.loc}</div>
                    </td>
                    <td>{t.owner}</td>
                    <td><span className={cls}>{label}</span></td>
                    <td className="r num" style={{ fontWeight: 500 }}>{t.myBid ? eur(t.myBid.total) : "—"}</td>
                    <td>{t.status === "abierta" ? "en " + daysTo(t.closesAt) : dateLabel(t.closesAt)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {shown.length === 0 && (
        <p className="muted">
          {bids.length === 0 ? (
            <>Aún no has pujado. <Link href="/industrial/paquetes">Ver paquetes abiertos →</Link></>
          ) : (
            "No hay pujas en este filtro."
          )}
        </p>
      )}
    </div>
  );
}
