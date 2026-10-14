"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { searchIndustriales } from "@/server/actions/promotora";
import { TANTEO_HOURS, TANTEO_MAX } from "@/lib/rules";
import type { TanteoPick } from "@/lib/types";

/** Titulares del derecho de tanteo: búsqueda de industriales verificados por nombre o CIF. */
export function TanteoPicker({ value, onChange, sectors }: { value: TanteoPick[]; onChange: (v: TanteoPick[]) => void; sectors: string[] }) {
  const [on, setOn] = useState(value.length > 0);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<TanteoPick[]>([]);
  const [searching, setSearching] = useState(false);
  const seq = useRef(0);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) {
      setResults([]);
      return;
    }
    const n = ++seq.current;
    setSearching(true);
    const timer = setTimeout(async () => {
      const r = await searchIndustriales(term);
      if (n !== seq.current) return; // respuesta de una búsqueda anterior
      setSearching(false);
      setResults(r.ok ? r.results : []);
    }, 250);
    return () => clearTimeout(timer);
  }, [q]);

  const add = (p: TanteoPick) => {
    if (value.some((x) => x.id === p.id) || value.length >= TANTEO_MAX) return;
    onChange([...value, p]);
    setQ("");
    setResults([]);
  };
  const toggle = (next: boolean) => {
    setOn(next);
    if (!next) onChange([]);
  };
  const applies = (p: TanteoPick) => sectors.filter((s) => p.trades.includes(s));

  return (
    <div className="stack" style={{ gap: 10 }}>
      <label className="row" style={{ gap: 8, cursor: "pointer", alignItems: "flex-start", flexWrap: "nowrap" }}>
        <input type="checkbox" checked={on} onChange={(e) => toggle(e.target.checked)} style={{ marginTop: 3 }} />
        <span className="stack" style={{ gap: 2 }}>
          <span>Dar derecho de tanteo a industriales de confianza</span>
          <span className="xs muted">
            Si su oferta no es la más baja, tendrán {TANTEO_HOURS} h tras el cierre para igualar la mejor; si varios igualan, eliges tú. Para ejercerlo
            tienen que pujar antes del cierre. Los demás industriales verán que el paquete tiene tanteo, pero no quién lo tiene.
          </span>
        </span>
      </label>

      {on && (
        <div className="stack" style={{ gap: 10, paddingLeft: 24 }}>
          {value.map((p) => {
            const secs = applies(p);
            return (
              <div key={p.id} className="row between" style={{ gap: 8, padding: "8px 12px", border: "1px solid var(--color-divider)" }}>
                <span className="stack" style={{ gap: 2 }}>
                  <span style={{ fontWeight: 500 }}>{p.name}</span>
                  <span className="xs muted">
                    {p.city}
                    {secs.length ? " · tanteo en " + secs.join(", ") : " · no trabaja en ningún oficio de estas partidas: no tendrá tanteo"}
                  </span>
                </span>
                <button type="button" className="btn btn-ghost" aria-label={"Quitar a " + p.name} onClick={() => onChange(value.filter((x) => x.id !== p.id))}>
                  <X size={15} strokeWidth={1.5} />
                </button>
              </div>
            );
          })}
          {value.length < TANTEO_MAX ? (
            <div className="stack" style={{ gap: 4, position: "relative", maxWidth: 480 }}>
              <input
                className="input"
                placeholder="Busca un industrial por nombre o CIF"
                aria-label="Buscar industrial para el derecho de tanteo"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
              {q.trim().length >= 2 && (
                <div className="stack" style={{ gap: 0, border: "1px solid var(--color-divider)", background: "var(--color-bg)" }}>
                  {results
                    .filter((r) => !value.some((x) => x.id === r.id))
                    .map((r) => (
                      <button key={r.id} type="button" className="linklike" onClick={() => add(r)} style={{ textAlign: "left", padding: "8px 12px", borderBottom: "1px solid var(--color-divider)" }}>
                        <span style={{ fontWeight: 500 }}>{r.name}</span>
                        <span className="xs muted"> · {r.city} · {r.trades.join(", ") || "sin oficios"}</span>
                      </button>
                    ))}
                  {!searching && !results.length && <span className="xs muted" style={{ padding: "8px 12px" }}>Ningún industrial verificado con ese nombre o CIF.</span>}
                  {searching && <span className="xs muted" style={{ padding: "8px 12px" }}>Buscando…</span>}
                </div>
              )}
            </div>
          ) : (
            <span className="xs muted">Máximo {TANTEO_MAX} titulares.</span>
          )}
        </div>
      )}
    </div>
  );
}
