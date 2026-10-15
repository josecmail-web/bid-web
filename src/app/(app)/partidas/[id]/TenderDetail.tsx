"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useUI } from "@/lib/store";
import { CERTS } from "@/lib/catalog";
import { awardTender } from "@/server/actions/promotora";
import type { TenderDetailDTO } from "@/lib/types";
import { avg, closeLabel, dot, eur, eur2, num, pct, stars } from "@/lib/format";
import { TANTEO_LABEL, tenderCloseText } from "@/lib/tender";
import { TANTEO_HOURS } from "@/lib/rules";
import { STATUS } from "@/lib/catalog";
import { Blueprint, CatBars, ItemText, Seg } from "@/components/ui";
import { ReviewBlock } from "./ReviewBlock";

/** Resalta el importe más bajo de cada partida (ajuste del prototipo). */
const HIGHLIGHT_LOWEST = true;

export function TenderDetail({ T }: { T: TenderDetailDTO }) {
  const { flash, openProfile } = useUI();
  const [pending, start] = useTransition();
  const [mode, setMode] = useState<"matrix" | "ranking">("matrix");
  const [sort, setSort] = useState<"price" | "rating">("price");
  const [confirmId, setConfirmId] = useState<string | null>(null);
  // En el móvil la comparativa por partidas no cabe: se empieza por el ranking
  useEffect(() => {
    if (window.matchMedia("(max-width: 640px)").matches) setMode("ranking");
  }, []);

  const [statusLabel, tagClass] = STATUS[T.status];
  const isSealed = T.status === "abierta";
  const hasBids = T.bids.length > 0 && !isSealed;
  const tanteoOn = !!T.tanteo?.active;
  const canAward = T.status === "evaluacion" && !tanteoOn;
  const tanteoOf = (id: string) => T.tanteo?.holders.find((h) => h.id === id);
  const tot = T.bids.map((b) => T.items.reduce((a, p, i) => a + b.p[i] * p.q, 0));
  const minT = tot.length ? Math.min(...tot) : 0;

  const facts: [string, string][] = [["Partidas", String(T.items.length)], [isSealed ? "Cierre" : "Cerrada el", tenderCloseText(T)]];
  if (T.ref) facts.push(["Presupuesto de referencia", eur(T.ref)]);
  if (tot.length && !isSealed) facts.push(["Oferta más baja", eur(minT)]);
  if (isSealed) facts.push(["Sobres", String(T.sealed)]);

  const cols = T.bids.map(({ bidder: I }, j) => {
    const av = I.r ? avg(I.r) : 0;
    const isMin = tot[j] === minT;
    const certCodes = I.certCodes;
    return {
      id: I.id, I, av, isMin, total: tot[j], certCodes,
      rating: I.r ? av.toFixed(1) : "—",
      jobs: I.jobs ? I.jobs + " obras" : "Nueva en Bidra",
      vsMin: isMin ? "Oferta más baja" : pct(tot[j] / minT).replace(" %", " % sobre la más baja"),
      diff: T.ref ? pct(tot[j] / T.ref) + " vs referencia" : "",
      awarded: T.awardedCompanyId === I.id,
    };
  });
  const ranking = cols.slice().sort((a, b) => (sort === "price" ? a.total - b.total : b.av - a.av));
  const winner = cols.find((c) => c.awarded);
  const confirm = confirmId ? cols.find((c) => c.id === confirmId) : null;

  const doAward = () => {
    if (!confirmId) return;
    start(async () => {
      const r = await awardTender(T.id, confirmId);
      setConfirmId(null);
      flash(r.ok ? dot("Adjudicada a " + r.name) + " Notificaciones enviadas." : r.error);
    });
  };

  return (
    <div className="stack" style={{ gap: 24 }}>
      <div className="stack" style={{ gap: 6 }}>
        <div className="row" style={{ gap: 8, fontSize: 13 }}>
          <Link href="/partidas" className="btn btn-ghost"><ArrowLeft size={15} strokeWidth={1.5} /> Partidas</Link>
          <span className="mono-12">{T.id} · {T.sector}</span>
          <span className={tagClass}>{statusLabel}</span>
        </div>
        <h1>{T.title}</h1>
        <div className="muted">{T.obra} · {T.loc}</div>
        <div className="row small" style={{ gap: 6, marginTop: 6 }}>
          <span className="muted">Certificados exigidos</span>
          {T.req.map((r) => <span key={r} className="tag tag-outline" title={CERTS[r].name}>{CERTS[r].code}</span>)}
          <span className="muted">· solo pujan industriales con estos certificados validados</span>
        </div>
      </div>

      <Blueprint className="facts" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))" }}>
        {facts.map(([k, v]) => (
          <div key={k} className="fact">
            <div className="label">{k}</div>
            <div className="figure" style={{ fontSize: 26 }}>{v}</div>
          </div>
        ))}
      </Blueprint>

      {T.status === "adjudicada" && winner && (
        <div className="row between" style={{ gap: 12, padding: "16px 18px", background: "var(--color-accent-900)", color: "#f2f2f3" }}>
          <div>
            <div style={{ fontSize: 11, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--color-accent-300)" }}>Adjudicada</div>
            <div className="figure" style={{ fontSize: 24 }}>{winner.I.name} · {eur(winner.total)}</div>
          </div>
          <span style={{ fontSize: 14, color: "var(--color-accent-200)" }}>El resto de industriales ha recibido aviso de no adjudicación, sin importes.</span>
        </div>
      )}

      {T.status === "adjudicada" && winner && (
        <div id="valorar">
          <ReviewBlock tenderId={T.id} name={winner.I.name} review={T.review} />
        </div>
      )}

      {T.tanteo && T.status !== "adjudicada" && (
        <div className="stack small" style={{ gap: 8, padding: "14px 18px", border: "1px solid var(--color-accent-300)", background: tanteoOn ? "var(--color-accent-100)" : undefined, maxWidth: 880 }}>
          <span className="figure" style={{ fontSize: 18 }}>
            {isSealed ? "Paquete con derecho de tanteo" : tanteoOn ? `Derecho de tanteo en curso hasta el ${closeLabel(T.tanteo.until)}` : "Derecho de tanteo resuelto"}
          </span>
          <span className="muted">
            {isSealed
              ? `Si la oferta de un titular no es la más baja, tendrá ${TANTEO_HOURS} h tras el cierre para igualar la mejor. Para ejercerlo tiene que pujar antes del cierre. Los demás industriales saben que hay tanteo, pero no quién lo tiene.`
              : tanteoOn
                ? "Podrás adjudicar cuando respondan los titulares o termine el plazo. Si varios igualan la mejor oferta, eliges tú."
                : "Ya puedes adjudicar. Si varios titulares han igualado la mejor oferta, eliges tú."}
          </span>
          <div className="stack" style={{ gap: 4 }}>
            {T.tanteo.holders.map((h) => (
              <span key={h.id} className="row" style={{ gap: 8 }}>
                <button className="linklike" onClick={() => openProfile(h.id)} style={{ fontWeight: 500 }}>{h.name}</button>
                <span className="muted">
                  {isSealed ? "titular" : TANTEO_LABEL[h.status].replace("Tanteo: ", "")}
                  {h.status === "matched" && h.original !== null ? ` (su oferta era de ${eur(h.original)})` : ""}
                  {h.status === "pending" && h.best !== null && h.original !== null ? ` · su oferta ${eur(h.original)}, la mejor ${eur(h.best)}` : ""}
                </span>
              </span>
            ))}
          </div>
        </div>
      )}

      {isSealed && (
        <div className="stack" style={{ gap: 14 }}>
          <div className="row between" style={{ alignItems: "baseline", gap: 10 }}>
            <h3>Sobres recibidos</h3>
            <span className="muted" style={{ fontSize: 14 }}>Puja ciega · se abren al cierre, {tenderCloseText(T)}</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(150px,1fr))", gap: 20 }}>
            {Array.from({ length: T.sealed }, (_, i) => (
              <Blueprint key={i} className="stack stripes-accent" style={{ aspectRatio: "4/3", justifyContent: "space-between", padding: 12 }}>
                <span className="mono">SOBRE {String(i + 1).padStart(2, "0")}</span>
                <span className="figure" style={{ fontSize: 18 }}>Cerrado</span>
              </Blueprint>
            ))}
            {T.sealed === 0 && (
              <div className="muted" style={{ fontSize: 14 }}>Aún no hay pujas. Los industriales verificados de {T.sector} ya han sido notificados.</div>
            )}
          </div>
        </div>
      )}

      {hasBids && (
        <div className="stack" style={{ gap: 16 }}>
          <div className="row between" style={{ gap: 12 }}>
            <div className="row" style={{ gap: 12 }}>
              <h3>{T.bids.length} pujas</h3>
              <Seg size="sm" options={["matrix", "ranking"] as const} labels={["Comparativa por partidas", "Ranking"]} value={mode} onChange={setMode} />
            </div>
            <span className="small muted">Ningún industrial ha visto las ofertas de los demás.</span>
          </div>

          {mode === "matrix" ? (
            <>
              <Blueprint>
                <div className="scroll-x">
                  <table className="table" style={{ minWidth: 860 }}>
                    <thead>
                      <tr>
                        <th style={{ verticalAlign: "bottom", minWidth: 240, padding: 12 }}>Partida</th>
                        {cols.map((c) => (
                          <th key={c.id} style={{ verticalAlign: "bottom", padding: 12, textTransform: "none", letterSpacing: 0, minWidth: 150, textAlign: "right", background: c.awarded ? "var(--color-accent-100)" : undefined }}>
                            <div className="stack" style={{ alignItems: "flex-end", gap: 2 }}>
                              {c.awarded && <span className="tag tag-accent">Adjudicada</span>}
                              {tanteoOf(c.id) && <span className={tanteoOf(c.id)!.status === "matched" ? "tag tag-accent" : "tag tag-outline"}>{TANTEO_LABEL[tanteoOf(c.id)!.status]}</span>}
                              <button
                                className="linklike"
                                onClick={() => openProfile(c.id)}
                                style={{ font: "600 15px/1.15 var(--font-heading)", textAlign: "right", textDecoration: "underline", textDecorationColor: "var(--color-divider)", textUnderlineOffset: 3 }}
                              >
                                {c.I.name}
                              </button>
                              <span className="xs" style={{ color: "var(--color-accent-700)" }}>
                                {c.I.r ? stars(c.av) : "☆☆☆☆☆"} <span className="muted">{c.rating} · {c.jobs}</span>
                              </span>
                              <span title={c.certCodes.join(" · ")} style={{ font: "500 10px ui-monospace,Menlo,monospace", color: "var(--color-neutral-700)", whiteSpace: "nowrap" }}>
                                {c.certCodes.length} certificados
                              </span>
                            </div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {T.items.map((p, i) => {
                        const vals = T.bids.map((b) => b.p[i] * p.q);
                        const mn = Math.min(...vals);
                        return (
                          <tr key={i}>
                            <td style={{ padding: "10px 12px" }}>
                              <div className="row" style={{ gap: 10, flexWrap: "nowrap", alignItems: "flex-start" }}>
                                <span className="mono" style={{ color: "var(--color-neutral-600)", paddingTop: 2 }}>{p.code}</span>
                                <div>
                                  <ItemText d={p.d} long={p.long} />
                                  <div className="xs muted">{num(p.q)} {p.u}</div>
                                </div>
                              </div>
                            </td>
                            {vals.map((x, j) => {
                              const hl = HIGHLIGHT_LOWEST && x === mn;
                              return (
                                <td key={j} className="r" style={{ padding: "10px 12px", background: hl ? "var(--color-accent-100)" : undefined, color: hl ? "var(--color-accent-800)" : undefined }}>
                                  <div className="num" style={{ fontWeight: 500 }}>{eur(x)}</div>
                                  <div style={{ fontSize: 11, opacity: 0.75 }}>{eur2(T.bids[j].p[i])} / {p.u}</div>
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })}
                      <tr>
                        <td className="figure" style={{ padding: "14px 12px", fontSize: 18, borderTop: "1px solid var(--color-divider)" }}>Total sin IVA</td>
                        {cols.map((c) => (
                          <td key={c.id} className="r" style={{ padding: "14px 12px", borderTop: "1px solid var(--color-divider)", background: HIGHLIGHT_LOWEST && c.isMin ? "var(--color-accent-100)" : undefined }}>
                            <div className="figure" style={{ fontSize: 20 }}>{eur(c.total)}</div>
                            <div className="xs muted">{c.vsMin}</div>
                            {c.diff && <div className="xs muted">{c.diff}</div>}
                          </td>
                        ))}
                      </tr>
                      {canAward && (
                        <tr>
                          <td style={{ borderBottom: 0 }} />
                          {cols.map((c) => (
                            <td key={c.id} className="r" style={{ padding: 12, borderBottom: 0 }}>
                              <button className="btn btn-secondary" onClick={() => setConfirmId(c.id)}>Adjudicar</button>
                            </td>
                          ))}
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </Blueprint>
              <div className="row xs muted" style={{ gap: 8 }}>
                <span style={{ width: 14, height: 14, background: "var(--color-accent-100)", border: "1px solid var(--color-accent-300)" }} />
                Importe más bajo de cada partida
              </div>
            </>
          ) : (
            <>
              <div className="row small muted" style={{ gap: 10 }}>
                Ordenar por
                <Seg size="xs" options={["price", "rating"] as const} labels={["Precio", "Valoración"]} value={sort} onChange={setSort} />
              </div>
              <div className="stack" style={{ gap: 22 }}>
                {ranking.map((c, i) => (
                  <Blueprint
                    key={c.id}
                    style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: "16px 28px", padding: "18px 20px", alignItems: "center", borderColor: c.awarded ? "var(--color-accent)" : undefined }}
                  >
                    <div className="row" style={{ gap: 14, alignItems: "flex-start", flexWrap: "nowrap" }}>
                      <span className="figure" style={{ fontSize: 34, lineHeight: 1, color: "var(--color-accent)" }}>{String(i + 1).padStart(2, "0")}</span>
                      <div className="stack" style={{ gap: 3 }}>
                        <button className="linklike" onClick={() => openProfile(c.id)} style={{ font: "600 20px/1.1 var(--font-heading)", textAlign: "left" }}>{c.I.name}</button>
                        <span className="small muted">{c.I.city} · {c.jobs}</span>
                        <div className="row" style={{ gap: 4 }}>
                          {c.certCodes.map((k) => <span key={k} className="tag tag-neutral">{k}</span>)}
                        </div>
                        {c.awarded && <span className="tag tag-accent" style={{ alignSelf: "flex-start" }}>Adjudicada</span>}
                        {tanteoOf(c.id) && <span className={tanteoOf(c.id)!.status === "matched" ? "tag tag-accent" : "tag tag-outline"} style={{ alignSelf: "flex-start" }}>{TANTEO_LABEL[tanteoOf(c.id)!.status]}</span>}
                      </div>
                    </div>
                    <div>
                      {c.I.r ? <CatBars r={c.I.r} /> : <span className="small muted">Sin valoraciones todavía · primera obra en Bidra</span>}
                    </div>
                    <div className="row" style={{ justifyContent: "flex-end", gap: 14 }}>
                      <div style={{ textAlign: "right" }}>
                        <div className="figure" style={{ fontSize: 26 }}>{eur(c.total)}</div>
                        <div className="xs muted">{c.vsMin} · {c.rating} ★</div>
                      </div>
                      {canAward && <button className="btn btn-secondary" onClick={() => setConfirmId(c.id)}>Adjudicar</button>}
                    </div>
                  </Blueprint>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {isSealed && (
        <div className="stack" style={{ gap: 12 }}>
          <h3>Partidas publicadas</h3>
          <div className="scroll-x">
            <table className="table" style={{ minWidth: 520 }}>
              <thead><tr><th>Cód.</th><th>Descripción</th><th className="r">Medición</th></tr></thead>
              <tbody>
                {T.items.map((p, i) => (
                  <tr key={i}>
                    <td className="mono-12" style={{ color: "var(--color-neutral-600)" }}>{p.code}</td>
                    <td><ItemText d={p.d} long={p.long} /></td>
                    <td className="r num">{num(p.q)} {p.u}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {confirm && (
        <div className="dialog-backdrop" onClick={() => setConfirmId(null)}>
          <Blueprint className="dialog" role="dialog" aria-modal="true" onClick={(e: React.MouseEvent) => e.stopPropagation()}>
            <div className="dialog-title">¿Adjudicar a {confirm.I.name}?</div>
            <div className="dialog-body stack" style={{ gap: 8 }}>
              <div className="cells" style={{ gridTemplateColumns: "1fr 1fr" }}>
                <div style={{ padding: "10px 12px" }}><div className="label">Importe</div><div className="figure" style={{ fontSize: 22 }}>{eur(confirm.total)}</div></div>
                <div style={{ padding: "10px 12px" }}><div className="label">Valoración</div><div className="figure" style={{ fontSize: 22 }}>{confirm.rating} ★</div></div>
              </div>
              <span>Se notificará al industrial. El resto recibirá aviso de no adjudicación sin conocer los importes.</span>
            </div>
            <div className="dialog-actions">
              <button className="btn btn-secondary" onClick={() => setConfirmId(null)}>Cancelar</button>
              <button className="btn btn-primary" onClick={doAward} disabled={pending} autoFocus>{pending ? "Adjudicando…" : "Confirmar adjudicación"}</button>
            </div>
          </Blueprint>
        </div>
      )}
    </div>
  );
}
