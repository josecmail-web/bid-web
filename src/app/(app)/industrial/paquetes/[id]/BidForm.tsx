"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useUI } from "@/lib/store";
import { CATS, CERTS } from "@/lib/catalog";
import { avg, closeLabel, dateLabel, dec1, eur, ratingMin, eur2, num, parsePrice, priceInput, stars } from "@/lib/format";
import { importBidPrices, submitBid } from "@/server/actions/industrial";
import type { IndustrialTenderDTO } from "@/lib/types";
import { PILOT, TARIFF_TEXT, feeFor } from "@/lib/pricing";
import { Blueprint, PrimaryButton } from "@/components/ui";

const draftKey = (id: string) => "bid-draft:" + id;

function readDraft(id: string): string[] | null {
  try {
    const raw = localStorage.getItem(draftKey(id));
    return raw ? (JSON.parse(raw) as string[]) : null;
  } catch {
    return null;
  }
}

function monthLabel(ym: string) {
  const [y, m] = ym.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("es-ES", { month: "long", year: "numeric" });
}

export function BidForm({ T }: { T: IndustrialTenderDTO }) {
  const { flash } = useUI();
  const [pending, start] = useTransition();
  const saved = useMemo(() => T.items.map((_, i) => (T.myPrices ? priceInput(T.myPrices[i]) : "")), [T.items, T.myPrices]);
  const [prices, setPrices] = useState<string[]>(saved);
  const [restored, setRestored] = useState(false);
  const [err, setErr] = useState("");
  const [showMissing, setShowMissing] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [imported, setImported] = useState<{ msg: string; warnings: string[] } | null>(null);
  const [importing, startImport] = useTransition();
  const xlsRef = useRef<HTMLInputElement>(null);

  const editable = T.status === "abierta" && T.eligible && T.verified;
  /** ¿Difieren estos precios de lo enviado? (numérico: "1.850,50" = 1850,5) */
  const differs = (ps: string[]) =>
    T.myPrices ? ps.some((p, i) => parsePrice(p) !== T.myPrices![i]) : ps.some((p) => p.trim() !== "");
  const dirty = differs(prices);

  // Borrador local de precios sin enviar (solo en este navegador)
  useEffect(() => {
    if (!editable) return;
    const d = readDraft(T.id);
    if (d && d.length === saved.length && differs(d)) {
      setPrices(d);
      setRestored(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [T.id, editable, saved]);
  useEffect(() => {
    if (!editable) return;
    try {
      if (dirty) localStorage.setItem(draftKey(T.id), JSON.stringify(prices));
      else localStorage.removeItem(draftKey(T.id));
    } catch {}
  }, [prices, dirty, editable, T.id]);

  const unit = prices.map(parsePrice);
  const valid = unit.map((v) => Number.isFinite(v) && v > 0);
  const amounts = unit.map((v, i) => (valid[i] ? v * T.items[i].q : 0));
  const total = amounts.reduce((a, b) => a + b, 0);
  const filled = valid.filter(Boolean).length;

  const setPrice = (i: number, v: string) => {
    setPrices((ps) => ps.map((p, j) => (j === i ? v : p)));
    setErr("");
  };

  const review = () => {
    if (filled < T.items.length) {
      setShowMissing(true);
      const n = T.items.length - filled;
      return setErr(n === 1 ? "Falta el precio unitario de 1 partida." : `Falta el precio unitario de ${n} partidas.`);
    }
    setConfirm(true);
  };

  /** Rellena el formulario con los precios de un Excel (no envía la puja). */
  const importExcel = (file: File) => {
    const fd = new FormData();
    fd.set("file", file);
    startImport(async () => {
      const r = await importBidPrices(T.id, fd);
      if (!r.ok) {
        setImported(null);
        return setErr(r.error);
      }
      const next = prices.map((p, i) => (r.prices[i] !== null ? priceInput(r.prices[i]!) : p));
      setPrices(next);
      setErr("");
      const missing = next.filter((p) => !(parsePrice(p) > 0)).length;
      setShowMissing(missing > 0);
      setImported({
        msg:
          `${r.matched} de ${T.items.length} precios importados desde ${file.name}.` +
          (missing
            ? ` Faltan ${missing} por completar.`
            : r.matched < T.items.length
              ? " El resto conserva el precio que ya tenías. Revisa el total y envía la puja."
              : " Revisa el total y envía la puja."),
        warnings: r.warnings,
      });
    });
  };

  const send = () =>
    start(async () => {
      const r = await submitBid(T.id, unit);
      setConfirm(false);
      if (!r.ok) return setErr(r.error);
      try {
        localStorage.removeItem(draftKey(T.id));
      } catch {}
      setRestored(false);
      setImported(null);
      setPrices(unit.map(priceInput));
      setShowMissing(false);
      flash(
        (T.myBid ? `Puja de ${T.id} actualizada: ${eur(total)}.` : `Puja enviada a ${T.id} por ${eur(total)}.`) + " Puedes modificarla hasta el cierre.",
      );
    });

  const facts: [string, string][] = [["Partidas", String(T.items.length)], [T.status === "abierta" ? "Cierre" : "Cerrada el", T.status === "abierta" ? closeLabel(T.closesAt) : dateLabel(T.closesAt)]];
  if (T.startMonth) facts.push(["Inicio previsto", monthLabel(T.startMonth)]);
  if (T.myBid) facts.push(["Mi oferta", eur(T.myBid.total)]);

  const statusTag =
    T.result === "won" ? ["Adjudicada", "tag tag-accent"] : T.result === "lost" ? ["No adjudicada", "tag tag-neutral"] : T.status === "evaluacion" ? ["En evaluación", "tag tag-outline"] : T.myBid ? ["Puja enviada", "tag tag-accent"] : ["Abierta", "tag tag-outline"];

  return (
    <div className="stack" style={{ gap: 24 }}>
      <div className="stack" style={{ gap: 6 }}>
        <div className="row" style={{ gap: 8, fontSize: 13 }}>
          <Link href={T.myBid && T.status !== "abierta" ? "/industrial/pujas" : "/industrial/paquetes"} className="btn btn-ghost">
            <ArrowLeft size={15} strokeWidth={1.5} /> {T.myBid && T.status !== "abierta" ? "Mis pujas" : "Paquetes"}
          </Link>
          <span className="mono-12">{T.id} · {T.sector}</span>
          <span className={statusTag[1]}>{statusTag[0]}</span>
        </div>
        <h1>{T.title}</h1>
        <div className="muted">{T.obra} · {T.loc} · {T.owner}</div>
        <div className="row small" style={{ gap: 6, marginTop: 6 }}>
          <span className="muted">Certificados exigidos</span>
          {T.req.map((r) => <span key={r} className="tag tag-outline" title={CERTS[r].name}>{CERTS[r].code}</span>)}
          {T.minRating && <span className="muted">· valoración mínima {ratingMin(T.minRating)}+ ★</span>}
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

      {T.result === "won" && (
        <div className="row between" style={{ gap: 12, padding: "16px 18px", background: "var(--color-accent-900)", color: "#f2f2f3" }}>
          <div>
            <div style={{ fontSize: 11, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--color-accent-300)" }}>Adjudicada</div>
            <div className="figure" style={{ fontSize: 24 }}>Te han adjudicado este paquete · {T.myBid && eur(T.myBid.total)}</div>
          </div>
          <span className="stack" style={{ fontSize: 14, color: "var(--color-accent-200)", gap: 2 }}>
            <span>{T.owner} se pondrá en contacto contigo para la contratación.</span>
            {T.fee && (
              <span style={{ fontSize: 13 }}>
                Comisión BID: {eur2(T.fee.amount)}{T.fee.status === "waived_pilot" ? " · exenta durante el piloto" : ""}
              </span>
            )}
          </span>
        </div>
      )}
      {T.result === "won" && (
        <div className="stack small" style={{ gap: 6, padding: "14px 18px", border: "1px solid var(--color-divider)", maxWidth: 880 }}>
          {T.review ? (
            <>
              <div className="row between" style={{ gap: 8 }}>
                <span><b style={{ fontWeight: 500 }}>Valoración de {T.owner}</b> · {T.review.date}</span>
                <span className="stars">{stars(avg(T.review.r))} <span style={{ color: "var(--color-text)" }}>{dec1(avg(T.review.r))}</span></span>
              </div>
              <span className="xs muted">{CATS.map((c, k) => `${c} ${dec1(T.review!.r[k])}`).join(" · ")}</span>
              {T.review.comment && <span>“{T.review.comment}”</span>}
              <Link href="/industrial/perfil" className="xs">Ver todas tus valoraciones →</Link>
            </>
          ) : (
            <span className="muted">Cuando {T.owner} valore la obra, verás aquí su valoración. Cuenta en tu media pública.</span>
          )}
        </div>
      )}
      {T.result === "lost" && (
        <div className="stack" style={{ gap: 2, padding: "14px 18px", background: "var(--color-neutral-200)" }}>
          <span className="figure" style={{ fontSize: 20 }}>No adjudicada</span>
          <span className="small muted">La promotora ha elegido otra oferta. Como en toda puja ciega, no se comparten importes ni el nombre del adjudicatario.</span>
        </div>
      )}
      {T.status === "evaluacion" && (
        <div className="stack" style={{ gap: 2, padding: "14px 18px", background: "var(--color-accent-100)", color: "var(--color-accent-800)" }}>
          <span className="figure" style={{ fontSize: 20 }}>En evaluación</span>
          <span className="small">La puja cerró el {dateLabel(T.closesAt)}. La promotora está comparando las ofertas; te avisaremos del resultado.</span>
        </div>
      )}
      {T.status === "abierta" && T.myBid && !dirty && (
        <div className="row between" style={{ gap: 8, padding: "12px 16px", background: "var(--color-accent-100)", color: "var(--color-accent-800)", fontSize: 14 }}>
          <span><b style={{ fontWeight: 500 }}>Puja enviada</b> · última modificación {closeLabel(T.myBid.updatedAt)}</span>
          <span>Puedes modificarla hasta el cierre, {closeLabel(T.closesAt)}.</span>
        </div>
      )}
      {T.status === "abierta" && !T.verified && (
        <div className="small" style={{ padding: "12px 16px", border: "1px solid var(--color-divider)" }}>
          Tu empresa está pendiente de verificación: podrás enviar la puja cuando BID la apruebe.
        </div>
      )}

      {(T.description || T.files.length > 0) && (
        <div className="stack" style={{ gap: 10, maxWidth: 880 }}>
          <h3>Obra y condiciones</h3>
          {T.description && <p className="muted" style={{ margin: 0, whiteSpace: "pre-line" }}>{T.description}</p>}
          {T.files.length > 0 && (
            <div className="row" style={{ gap: 8 }}>
              {T.files.map((f) => (
                <a key={f.url} className="btn btn-secondary" href={f.url} target="_blank" rel="noreferrer">{f.name}</a>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="stack" style={{ gap: 12 }}>
        <div className="row between" style={{ alignItems: "baseline", gap: 10 }}>
          <h3>{editable ? "Tu presupuesto" : "Tu oferta"}</h3>
          <span className="small muted">
            {editable ? "Desglose obligatorio: un precio unitario por partida, sin IVA." : T.myBid ? "Precios enviados, sin IVA." : "Partidas del paquete."}
          </span>
        </div>
        <div className="row between stripes" style={{ gap: 10, padding: "10px 14px", border: "1px dashed var(--color-divider)" }}>
          <span className="small muted">
            {editable ? "¿Presupuestas en Excel? Descarga las partidas, rellena la columna de precios y súbela." : "Descarga tu oferta en Excel."}
          </span>
          <div className="row" style={{ gap: 8 }}>
            {(editable || T.myBid) && (
              <a className="btn btn-secondary" href={`/api/paquetes/${T.id}/excel`} download>
                {editable ? "Descargar Excel" : "Descargar mi oferta (.xlsx)"}
              </a>
            )}
            {editable && (
              <>
                <button type="button" className="btn btn-secondary" disabled={importing} onClick={() => xlsRef.current?.click()}>
                  {importing ? "Leyendo…" : "Subir Excel con precios"}
                </button>
                <input
                  ref={xlsRef} type="file" accept=".xlsx,.xls,.ods,.csv" hidden
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) importExcel(f); e.target.value = ""; }}
                />
              </>
            )}
          </div>
        </div>
        {imported && editable && (
          <div className="stack small" style={{ gap: 4, padding: "10px 14px", background: "var(--color-accent-100)", color: "var(--color-accent-800)" }} role="status">
            <div className="row between" style={{ gap: 8 }}>
              <span>{imported.msg}</span>
              <button type="button" className="btn btn-ghost" onClick={() => setImported(null)} aria-label="Cerrar aviso">Cerrar</button>
            </div>
            {imported.warnings.map((w) => <span key={w} className="xs">{w}</span>)}
          </div>
        )}
        {restored && editable && (
          <div className="row between small" style={{ gap: 8, padding: "8px 12px", border: "1px dashed var(--color-divider)" }}>
            <span>Hemos recuperado precios que no llegaste a enviar.</span>
            <button type="button" className="btn btn-ghost" onClick={() => { setPrices(saved); setRestored(false); }}>Descartar</button>
          </div>
        )}
        <Blueprint>
          <div className="scroll-x">
            <table className="table" style={{ minWidth: 720 }}>
              <thead>
                <tr>
                  <th style={{ padding: 12 }}>Partida</th>
                  <th className="r" style={{ padding: 12, width: 130 }}>Medición</th>
                  <th className="r" style={{ padding: 12, width: 170 }}>Precio unitario</th>
                  <th className="r" style={{ padding: 12, width: 150 }}>Importe</th>
                </tr>
              </thead>
              <tbody>
                {T.items.map((p, i) => {
                  const bad = showMissing && !valid[i];
                  return (
                    <tr key={i}>
                      <td style={{ padding: "10px 12px" }}>
                        <div className="row" style={{ gap: 10, flexWrap: "nowrap", alignItems: "flex-start" }}>
                          <span className="mono" style={{ color: "var(--color-neutral-600)", paddingTop: 2 }}>{p.code}</span>
                          <span>{p.d}</span>
                        </div>
                      </td>
                      <td className="r num muted" style={{ padding: "10px 12px" }}>{num(p.q)} {p.u}</td>
                      <td className="r" style={{ padding: "6px 12px" }}>
                        {editable ? (
                          <div className="row" style={{ gap: 6, justifyContent: "flex-end", flexWrap: "nowrap" }}>
                            <input
                              className="input num"
                              inputMode="decimal"
                              aria-label={"Precio unitario de " + p.d}
                              aria-invalid={bad}
                              value={prices[i]}
                              onChange={(e) => setPrice(i, e.target.value)}
                              placeholder="0,00"
                              style={{ width: 110, minHeight: 32, textAlign: "right", borderColor: bad ? "#9a3b2e" : undefined }}
                            />
                            <span className="xs muted" style={{ width: 34, textAlign: "left" }}>€/{p.u}</span>
                          </div>
                        ) : (
                          <span className="num">{T.myPrices ? eur2(T.myPrices[i]) + " / " + p.u : "—"}</span>
                        )}
                      </td>
                      <td className="r num" style={{ padding: "10px 12px", fontWeight: 500 }}>
                        {editable ? (valid[i] ? eur(amounts[i]) : "—") : T.myPrices ? eur(T.myPrices[i] * p.q) : "—"}
                      </td>
                    </tr>
                  );
                })}
                <tr>
                  <td className="figure" style={{ padding: "14px 12px", fontSize: 18, borderTop: "1px solid var(--color-divider)" }}>Total sin IVA</td>
                  <td style={{ borderTop: "1px solid var(--color-divider)" }} />
                  <td className="r xs muted" style={{ padding: "14px 12px", borderTop: "1px solid var(--color-divider)" }}>
                    {editable ? `${filled} de ${T.items.length} partidas con precio` : ""}
                  </td>
                  <td className="r" style={{ padding: "14px 12px", borderTop: "1px solid var(--color-divider)" }}>
                    <div className="figure" style={{ fontSize: 24 }}>{editable ? eur(total) : T.myBid ? eur(T.myBid.total) : "—"}</div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </Blueprint>

        {editable && (
          <>
            {err && <div className="err" role="alert">{err}</div>}
            <div className="row between" style={{ gap: 10 }}>
              <span className="stack small muted" style={{ maxWidth: 520, gap: 4 }}>
                <span>Puja ciega: nadie más ve tu oferta, ni sabes cuántas pujas hay. Las ofertas se abren al cierre.</span>
                <span className="xs">
                  Pujar es gratis. Si te adjudican, la comisión de BID es el {TARIFF_TEXT}
                  {total > 0 && <> — con este total, {eur2(feeFor(total))}</>}
                  {PILOT ? ". Durante el piloto no se cobra." : "."}{" "}
                  <Link href="/condiciones" target="_blank">Condiciones</Link>
                </span>
              </span>
              <div className="row" style={{ gap: 10 }}>
                {T.myBid && dirty && (
                  <button type="button" className="btn btn-ghost" onClick={() => { setPrices(saved); setErr(""); setShowMissing(false); }}>Descartar cambios</button>
                )}
                <PrimaryButton className="btn-md" onClick={review} disabled={pending || (!!T.myBid && !dirty)}>
                  {T.myBid ? "Actualizar puja" : "Enviar puja"}
                </PrimaryButton>
              </div>
            </div>
          </>
        )}
      </div>

      {confirm && (
        <div className="dialog-backdrop" onClick={() => !pending && setConfirm(false)}>
          <Blueprint className="dialog" role="dialog" aria-modal="true" onClick={(e: React.MouseEvent) => e.stopPropagation()}>
            <div className="dialog-title">{T.myBid ? "¿Actualizar tu puja?" : "¿Enviar tu puja?"}</div>
            <div className="dialog-body stack" style={{ gap: 8 }}>
              <div className="cells" style={{ gridTemplateColumns: "1fr 1fr" }}>
                <div style={{ padding: "10px 12px" }}><div className="label">Total sin IVA</div><div className="figure" style={{ fontSize: 22 }}>{eur(total)}</div></div>
                <div style={{ padding: "10px 12px" }}><div className="label">Partidas</div><div className="figure" style={{ fontSize: 22 }}>{T.items.length}</div></div>
              </div>
              <span>Nadie más verá tu oferta. Podrás modificarla hasta el cierre, {closeLabel(T.closesAt)}.</span>
            </div>
            <div className="dialog-actions">
              <button className="btn btn-secondary" onClick={() => setConfirm(false)} disabled={pending}>Cancelar</button>
              <button className="btn btn-primary" onClick={send} disabled={pending} autoFocus>{pending ? "Enviando…" : "Confirmar envío"}</button>
            </div>
          </Blueprint>
        </div>
      )}
    </div>
  );
}
