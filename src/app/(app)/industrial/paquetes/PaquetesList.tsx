"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CERTS } from "@/lib/catalog";
import { daysTo, eur, ratingMin } from "@/lib/format";
import type { IndustrialTenderCardDTO } from "@/lib/types";
import { Blueprint } from "@/components/ui";

type Filter = "todos" | "sin" | "pujados" | "bloqueados";

/** Qué le falta para poder pujar, en una línea. */
export function accessNote(t: IndustrialTenderCardDTO) {
  const parts: string[] = [];
  if (t.missing.length) {
    const pend = t.missing.filter((m) => t.missingPending.includes(m));
    const rest = t.missing.filter((m) => !t.missingPending.includes(m));
    if (rest.length) parts.push("Necesitas " + rest.map((m) => CERTS[m].code).join(" + "));
    if (pend.length) parts.push(pend.map((m) => CERTS[m].code).join(" + ") + " en revisión");
  }
  if (t.ratingTooLow) parts.push("Exige valoración " + ratingMin(t.minRating ?? 0) + "+ ★");
  return parts.join(" · ");
}

export function PaquetesList({ tenders, companyName }: { tenders: IndustrialTenderCardDTO[]; companyName: string }) {
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>("todos");
  const groups: Record<Filter, IndustrialTenderCardDTO[]> = {
    todos: tenders,
    sin: tenders.filter((t) => t.eligible && !t.myBid),
    pujados: tenders.filter((t) => t.myBid),
    bloqueados: tenders.filter((t) => !t.eligible && !t.myBid),
  };
  const FILTERS: [Filter, string][] = [["todos", "Todos"], ["sin", "Sin pujar"], ["pujados", "Con mi puja"], ["bloqueados", "Sin acceso"]];
  const shown = groups[filter];

  return (
    <div className="stack" style={{ gap: 22 }}>
      <div className="row between" style={{ alignItems: "flex-end", gap: 16 }}>
        <div>
          <div className="kicker">{companyName}</div>
          <h1 style={{ marginTop: 2 }}>Paquetes abiertos</h1>
        </div>
        <span className="small muted" style={{ maxWidth: 420 }}>
          Puja ciega: nadie ve tu oferta, y tú no ves las de los demás ni cuántas hay. Puedes modificarla hasta el cierre.
        </span>
      </div>

      <div style={{ display: "flex", overflowX: "auto" }}>
        <div className="segbar sm nowrap" role="group" aria-label="Filtrar paquetes">
          {FILTERS.map(([k, l]) => (
            <button key={k} type="button" aria-pressed={k === filter} onClick={() => setFilter(k)}>
              {l} · {groups[k].length}
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(min(100%,320px),1fr))", gap: 26 }}>
        {shown.map((t) => {
          const open = t.eligible || !!t.myBid;
          const tag = t.myBid ? ["Puja enviada", "tag tag-accent"] : t.eligible ? ["Abierta", "tag tag-outline"] : ["Sin acceso", "tag tag-neutral"];
          const body = (
            <>
              <div className="row between" style={{ gap: 10, flexWrap: "nowrap", width: "100%" }}>
                <span className="mono">{t.id} · {t.sector}</span>
                <span className={tag[1]}>{tag[0]}</span>
              </div>
              <div className="figure" style={{ fontSize: 24, lineHeight: 1.1 }}>{t.title}</div>
              <div className="muted" style={{ fontSize: 14 }}>{t.obra} · {t.loc}</div>
              <div className="xs muted">{t.owner}</div>
              {!open && <div className="xs" style={{ color: "var(--color-accent-800)" }}>{accessNote(t)}</div>}
              <div style={{ marginTop: "auto", display: "grid", gridTemplateColumns: "1fr 1fr", borderTop: "1px solid var(--color-divider)", paddingTop: 12, gap: 10, width: "100%" }}>
                <div>
                  <div className="label">{t.myBid ? "Mi oferta" : "Partidas"}</div>
                  <div className="figure" style={{ fontSize: 20 }}>{t.myBid ? eur(t.myBid.total) : t.itemCount}</div>
                </div>
                <div>
                  <div className="label">Cierra en</div>
                  <div className="figure" style={{ fontSize: 20 }}>{daysTo(t.closesAt)}</div>
                </div>
              </div>
            </>
          );
          return open ? (
            <Blueprint key={t.id} as="button" type="button" className="card-btn stack" style={{ padding: 18, gap: 10, minHeight: 200 }} onClick={() => router.push("/industrial/paquetes/" + t.id)}>
              {body}
            </Blueprint>
          ) : (
            <Blueprint key={t.id} className="stack" style={{ padding: 18, gap: 10, minHeight: 200, opacity: 0.8 }} aria-disabled="true">
              {body}
              <Link href="/industrial/perfil" className="btn btn-ghost" style={{ alignSelf: "flex-start", marginTop: -4 }}>
                {t.missing.length && t.missing.every((m) => t.missingPending.includes(m)) ? "Ver mis certificados →" : "Añadir certificados →"}
              </Link>
            </Blueprint>
          );
        })}
      </div>
      {shown.length === 0 && (
        <p className="muted">
          {tenders.length === 0
            ? "No hay paquetes abiertos de tus oficios ahora mismo. Te avisaremos cuando se publique uno."
            : "No hay paquetes en este filtro."}
        </p>
      )}
    </div>
  );
}
