"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { tenderSummary } from "@/lib/tender";
import type { TenderCardDTO, TenderStatus } from "@/lib/types";
import { Blueprint, PrimaryButton } from "@/components/ui";

type Filter = "todas" | TenderStatus;
const FILTERS: [Filter, string][] = [
  ["todas", "Todas"],
  ["abierta", "Abiertas"],
  ["evaluacion", "En evaluación"],
  ["adjudicada", "Adjudicadas"],
  ["borrador", "Borradores"],
];

export function PartidasList({ tenders, companyName }: { tenders: TenderCardDTO[]; companyName: string }) {
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>("todas");
  const shown = tenders.filter((t) => filter === "todas" || t.status === filter);

  return (
    <div className="stack" style={{ gap: 22 }}>
      <div className="row between" style={{ alignItems: "flex-end", gap: 16 }}>
        <div>
          <div className="kicker">{companyName}</div>
          <h1 style={{ marginTop: 2 }}>Partidas</h1>
        </div>
        <PrimaryButton style={{ minHeight: 40, fontSize: 16, padding: "0 18px" }} onClick={() => router.push("/partidas/nueva")}>
          <Plus size={16} strokeWidth={1.5} /> Publicar partidas
        </PrimaryButton>
      </div>

      <div style={{ display: "flex", overflowX: "auto" }}>
        <div className="segbar sm nowrap" role="group" aria-label="Filtrar por estado">
          {FILTERS.map(([k, l]) => {
            const n = k === "todas" ? tenders.length : tenders.filter((t) => t.status === k).length;
            return (
              <button key={k} type="button" aria-pressed={k === filter} onClick={() => setFilter(k)}>
                {l} · {n}
              </button>
            );
          })}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(min(100%,320px),1fr))", gap: 26 }}>
        {shown.map((t) => {
          const s = tenderSummary(t);
          return (
            <Blueprint
              key={t.id}
              as="button"
              type="button"
              className="card-btn stack"
              style={{ padding: 18, gap: 10, minHeight: 200 }}
              onClick={() => router.push(t.status === "borrador" ? `/partidas/nueva?borrador=${t.id}` : `/partidas/${t.id}`)}
            >
              <div className="row between" style={{ gap: 10, flexWrap: "nowrap" }}>
                <span className="mono">{t.id} · {t.sector}</span>
                <span className={s.tagClass}>{s.statusLabel}</span>
              </div>
              <div className="figure" style={{ fontSize: 24, lineHeight: 1.1 }}>{t.title}</div>
              <div className="muted" style={{ fontSize: 14 }}>{t.obra} · {t.loc}</div>
              {t.needsReview && (
                <span className="tag tag-outline" style={{ alignSelf: "flex-start" }}>★ Pendiente de valorar</span>
              )}
              <div style={{ marginTop: "auto", display: "grid", gridTemplateColumns: "1fr 1fr", borderTop: "1px solid var(--color-divider)", paddingTop: 12, gap: 10, width: "100%" }}>
                <div><div className="label">{s.k1}</div><div className="figure" style={{ fontSize: 20 }}>{s.v1}</div></div>
                <div><div className="label">{s.k2}</div><div className="figure" style={{ fontSize: 20 }}>{s.v2}</div></div>
              </div>
            </Blueprint>
          );
        })}
      </div>
      {shown.length === 0 && <p className="muted">No hay partidas en este estado.</p>}
    </div>
  );
}
