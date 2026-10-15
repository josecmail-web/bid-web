"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Plus, X } from "lucide-react";
import { useUI } from "@/lib/store";
import { CERTS, EXTRA_CERTS, SAMPLE, SECTOR_NAMES, TITLE, UNITS, reqFor } from "@/lib/catalog";
import { closeLabel, num, pad, parsePrice } from "@/lib/format";
import { importRows, mkRow, type ImportResult } from "@/lib/import";
import { validateWizardStep } from "@/lib/rules";
import { parseExcel, publishTenders, saveDraft as saveDraftAction, uploadProjectFile } from "@/server/actions/promotora";
import type { Sector, SectorOrNone, WizardRow, WizardState } from "@/lib/types";
import { Blueprint, Chips, Field, ItemText, PrimaryButton, Seg } from "@/components/ui";
import { TanteoPicker } from "./TanteoPicker";

const LABELS = ["Obra", "Partidas", "Condiciones", "Revisar"];

export function Wizard({ initial, projects }: { initial: WizardState; projects: string[] }) {
  const router = useRouter();
  const { flash } = useUI();
  // Borradores guardados antes de existir el tanteo no traen el campo
  const [W, setW] = useState<WizardState>({ ...initial, tanteo: initial.tanteo ?? [] });
  const [err, setErr] = useState("");
  const [drag, setDrag] = useState(false);
  const [nr, setNr] = useState({ d: "", u: "ud", q: "" });
  const [pending, start] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);
  const attachRef = useRef<HTMLInputElement>(null);

  const setWz = <K extends keyof WizardState>(k: K, v: WizardState[K]) => {
    setW((w) => ({ ...w, [k]: v }));
    setErr("");
  };
  const setParts = (fn: (ps: WizardRow[]) => WizardRow[]) => {
    setW((w) => ({ ...w, partidas: fn(w.partidas) }));
    setErr("");
  };

  const inc = W.partidas.filter((p) => p.on);
  const uncN = inc.filter((p) => !p.sector).length;
  const usedSecs = SECTOR_NAMES.filter((n) => inc.some((p) => p.sector === n));

  const applyImport = (res: ImportResult, name: string) => {
    if (!res.ok) return setErr(res.error);
    setW((w) => ({ ...w, partidas: res.rows, fileName: name, importNote: res.note }));
    setErr("");
    flash(res.rows.length + " partidas importadas y clasificadas en " + res.sectors + " sectores.");
  };

  /** El Excel se lee y clasifica en el servidor. */
  const readFile = (file: File) => {
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (ext === "pdf") return flash("La importación desde PDF llegará pronto. De momento, sube un Excel.");
    const fd = new FormData();
    fd.set("file", file);
    start(async () => applyImport(await parseExcel(fd), file.name));
  };

  const attach = (file: File) => {
    const fd = new FormData();
    fd.set("file", file);
    start(async () => {
      const r = await uploadProjectFile(fd);
      if (!r.ok) return setErr(r.error);
      setW((w) => ({ ...w, files: [...w.files, r.file] }));
      setErr("");
    });
  };

  const addRow = () => {
    if (!nr.d.trim()) return setErr("Escribe la descripción de la partida.");
    if (!(Number(nr.q) > 0)) return setErr("Indica la medición de la partida.");
    const p = mkRow(nr.d.trim(), nr.u, Number(nr.q), "", pad(W.partidas.length + 1));
    setParts((ps) => [...ps, p]);
    setNr({ d: "", u: "ud", q: "" });
    flash(p.sector ? "Partida añadida a " + p.sector + "." : "Partida añadida. Asígnale un sector.");
  };

  const back = () => {
    if (W.step === 0) return router.push("/partidas");
    setW((w) => ({ ...w, step: w.step - 1 }));
    setErr("");
  };

  const publish = () =>
    start(async () => {
      // El cierre se introduce en hora local del navegador; al servidor va en ISO
      const r = await publishTenders(W, new Date(W.close).toISOString());
      if (!r.ok) return setErr(r.error);
      flash(
        r.ids.length === 1
          ? r.ids[0] + " publicada. Se ha notificado a los industriales de " + r.sectors[0] + "."
          : r.ids.length + " paquetes publicados. Cada sector se ha notificado a sus industriales.",
      );
      router.push(r.ids.length === 1 ? "/partidas/" + r.ids[0] : "/partidas");
    });

  const next = () => {
    if (W.step < 3) {
      const e = validateWizardStep(W, W.step);
      if (e) return setErr(e);
      setW((w) => ({ ...w, step: w.step + 1 }));
      return setErr("");
    }
    publish();
  };

  const saveDraft = () =>
    start(async () => {
      const r = await saveDraftAction(W);
      if (!r.ok) return setErr(r.error);
      flash("Borrador " + r.id + " guardado.");
      router.push("/partidas");
    });

  const summary: [string, string][] = [
    ["Obra", W.obra], ["Ubicación", W.loc], ["Partidas", inc.length + " en " + usedSecs.length + " sectores"],
    ["Cierre", closeLabel(W.close || null)], ["Participación", "Industriales verificados del sector"],
    ["Valoración mínima", W.min], ["Certificados adicionales", W.extra.length ? W.extra.map((x) => CERTS[x].code).join(", ") : "Ninguno"],
    ["Derecho de tanteo", W.tanteo.length ? W.tanteo.map((p) => p.name).join(", ") : "No"],
  ];

  return (
    <div className="stack" style={{ gap: 22, maxWidth: 920 }}>
      <div>
        <button className="btn btn-ghost" onClick={() => router.push("/partidas")}><ArrowLeft size={15} strokeWidth={1.5} /> Partidas</button>
        <h1 style={{ marginTop: 6 }}>Publicar partidas</h1>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,minmax(0,1fr))", gap: 6 }}>
        {LABELS.map((l, i) => {
          const on = i <= W.step;
          return (
            <button
              key={l}
              type="button"
              disabled={i >= W.step}
              onClick={() => { setW((w) => ({ ...w, step: i })); setErr(""); }}
              aria-current={i === W.step ? "step" : undefined}
              style={{
                textAlign: "left", border: 0, background: "transparent", padding: "8px 0 0", cursor: i < W.step ? "pointer" : "default",
                boxShadow: `inset 0 2px 0 ${on ? "var(--color-accent)" : "var(--color-neutral-300)"}`,
                color: on ? "var(--color-accent-700)" : "var(--color-neutral-600)", display: "flex", flexDirection: "column", minWidth: 0, opacity: 1,
              }}
            >
              <span style={{ font: "500 11px ui-monospace,Menlo,monospace" }}>{pad(i + 1)}</span>
              <span style={{ font: "600 16px var(--font-heading)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{l}</span>
            </button>
          );
        })}
      </div>

      <Blueprint className="stack" style={{ padding: "clamp(18px,3vw,28px)", gap: 18 }}>
        {W.step === 0 && (
          <>
            <h3>¿En qué obra?</h3>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", gap: 14 }}>
              <Field label="Nombre de la obra">
                <input className="input" list="obras" value={W.obra} onChange={(e) => setWz("obra", e.target.value)} placeholder="Residencial Los Almendros · 48 viviendas" />
                <datalist id="obras">{projects.map((o) => <option key={o} value={o} />)}</datalist>
              </Field>
              <Field label="Ubicación">
                <input className="input" value={W.loc} onChange={(e) => setWz("loc", e.target.value)} placeholder="Municipio, provincia" />
              </Field>
              <Field label="Inicio previsto de los trabajos">
                <input className="input" type="month" value={W.start} onChange={(e) => setWz("start", e.target.value)} />
              </Field>
              <Field label="Descripción general y condiciones técnicas" style={{ gridColumn: "1/-1" }}>
                <textarea className="input" value={W.desc} onChange={(e) => setWz("desc", e.target.value)} placeholder="Incluye suministro, mano de obra, medios auxiliares…" />
              </Field>
            </div>
            <div className="row between stripes" style={{ gap: 12, padding: 14, border: "1px dashed var(--color-divider)" }}>
              <span className="mono-12">Planos, memoria, pliego (PDF, DWG)</span>
              <button className="btn btn-secondary" disabled={pending} onClick={() => attachRef.current?.click()}>
                {W.files.length ? W.files.length + " archivo" + (W.files.length > 1 ? "s" : "") + " · añadir" : "Adjuntar"}
              </button>
              <input
                ref={attachRef} type="file" accept=".pdf,.dwg,.dxf,.zip,.jpg,.jpeg,.png" hidden
                onChange={(e) => { const f = e.target.files?.[0]; if (f) attach(f); e.target.value = ""; }}
              />
            </div>
          </>
        )}

        {W.step === 1 && (
          <>
            <div className="row between" style={{ alignItems: "baseline", gap: 8 }}>
              <h3>Partidas</h3>
              <span className="small muted">Se publica un paquete por sector para que pujen los industriales de cada sector.</span>
            </div>
            <Blueprint
              className={"dropzone" + (drag ? " drag" : "")}
              onDragOver={(e: React.DragEvent) => { e.preventDefault(); setDrag(true); }}
              onDragLeave={() => setDrag(false)}
              onDrop={(e: React.DragEvent) => { e.preventDefault(); setDrag(false); const f = e.dataTransfer.files[0]; if (f) readFile(f); }}
            >
              <span className="figure" style={{ fontSize: 22 }}>{W.fileName ? "Reemplazar el Excel de mediciones" : "Sube el Excel de mediciones"}</span>
              <span className="small muted" style={{ maxWidth: 520, textWrap: "pretty" }}>
                Arrastra aquí un .xlsx, .xls o .csv con código, descripción, unidad y medición. Bidra detecta las columnas y clasifica cada partida por sector.
              </span>
              <div className="row" style={{ gap: 10, justifyContent: "center", marginTop: 4 }}>
                <PrimaryButton className="btn-md" disabled={pending} onClick={() => fileRef.current?.click()}>{pending ? "Leyendo…" : "Seleccionar Excel"}</PrimaryButton>
                <input
                  ref={fileRef} type="file" accept=".xlsx,.xls,.csv,.pdf" hidden
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) readFile(f); e.target.value = ""; }}
                />
                <button className="btn btn-secondary" disabled style={{ minHeight: 38 }}>PDF · próximamente</button>
              </div>
              <div className="row" style={{ gap: "4px 12px", justifyContent: "center" }}>
                <button className="btn btn-ghost" onClick={() => applyImport(importRows(SAMPLE, "mediciones-los-almendros.xlsx"), "mediciones-los-almendros.xlsx")}>
                  Probar con un Excel de ejemplo
                </button>
                <a className="btn btn-ghost" href="/api/plantilla" download>Descargar plantilla .xlsx</a>
              </div>
            </Blueprint>

            {W.partidas.length > 0 && (
              <>
                <div className="row" style={{ alignItems: "baseline", gap: "6px 14px" }}>
                  {W.fileName && <span className="mono-12">{W.fileName}</span>}
                  <span style={{ fontWeight: 500 }}>
                    {inc.length} partidas en {usedSecs.length} {usedSecs.length === 1 ? "sector" : "sectores"}
                    {uncN ? " · " + uncN + " sin clasificar" : ""}
                  </span>
                  <span className="xs muted">{W.importNote}</span>
                </div>
                <div className="cells" style={{ gridTemplateColumns: "repeat(auto-fill,minmax(150px,1fr))" }}>
                  {uncN > 0 && (
                    <div style={{ padding: "10px 12px", background: "var(--color-accent-100)" }}>
                      <div className="label" style={{ color: "var(--color-accent-800)" }}>Sin clasificar</div>
                      <div className="figure" style={{ fontSize: 24, lineHeight: 1.1 }}>{uncN}</div>
                    </div>
                  )}
                  {usedSecs.map((n) => (
                    <div key={n} style={{ padding: "10px 12px" }}>
                      <div className="label">{n}</div>
                      <div className="figure" style={{ fontSize: 24, lineHeight: 1.1 }}>{inc.filter((p) => p.sector === n).length}</div>
                    </div>
                  ))}
                </div>
                <div className="stack" style={{ gap: 16 }}>
                  {(["", ...SECTOR_NAMES] as SectorOrNone[]).map((sec) => {
                    const rows = W.partidas.filter((p) => p.sector === sec);
                    if (!rows.length) return null;
                    const nOn = rows.filter((r) => r.on).length;
                    const unc = sec === "";
                    return (
                      <div key={sec || "_none"} style={{ border: `1px solid ${unc ? "var(--color-accent)" : "var(--color-divider)"}` }}>
                        <div className="row between" style={{ gap: 8, padding: "8px 14px", background: unc ? "var(--color-accent-100)" : undefined, borderBottom: "1px solid var(--color-divider)" }}>
                          <div className="row" style={{ gap: 10 }}>
                            <span className="figure" style={{ fontSize: 19 }}>{unc ? "Sin clasificar" : sec}</span>
                            <span className={unc ? "tag tag-outline" : "tag tag-neutral"}>{unc ? "Revisar" : nOn + " de " + rows.length}</span>
                          </div>
                          <button className="btn btn-ghost" onClick={() => setParts((ps) => ps.map((p) => (p.sector === sec ? { ...p, on: !nOn } : p)))}>
                            {nOn ? "Excluir todas" : "Incluir todas"}
                          </button>
                        </div>
                        {rows.map((r) => (
                          <div
                            key={r.id}
                            className="row"
                            style={{ gap: "6px 12px", padding: "8px 14px", borderBottom: "1px solid color-mix(in srgb, var(--color-text) 8%, transparent)", opacity: r.on ? 1 : 0.45 }}
                          >
                            <span className="mono" style={{ width: 48, color: "var(--color-neutral-600)" }}>{r.code}</span>
                            <ItemText d={r.d} long={r.long} style={{ flex: "1 1 240px", fontSize: 14, textDecoration: r.on ? "none" : "line-through" }} />
                            {r.q > 0 ? (
                              <span className="num muted" style={{ width: 110, textAlign: "right", fontSize: 13 }}>{num(r.q) + " " + r.u}</span>
                            ) : (
                              <span className="row" style={{ width: 110, gap: 4, flexWrap: "nowrap", justifyContent: "flex-end" }}>
                                <input
                                  className="input num"
                                  inputMode="decimal"
                                  aria-label={"Medición de " + r.d}
                                  aria-invalid={r.on}
                                  placeholder="Medición"
                                  defaultValue=""
                                  onBlur={(e) => {
                                    const v = parsePrice(e.target.value);
                                    if (v > 0) setParts((ps) => ps.map((p) => (p.id === r.id ? { ...p, q: v } : p)));
                                  }}
                                  onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
                                  style={{ width: 76, minHeight: 32, padding: "4px 6px", fontSize: 13, textAlign: "right", borderColor: r.on ? "#9a3b2e" : undefined }}
                                />
                                <span className="xs muted">{r.u}</span>
                              </span>
                            )}
                            <select
                              className="input"
                              aria-label={"Sector de " + r.d}
                              style={{ width: 180, minHeight: 32, padding: "4px 8px", fontSize: 13 }}
                              value={r.sector}
                              onChange={(e) => { const v = e.target.value as SectorOrNone; setParts((ps) => ps.map((p) => (p.id === r.id ? { ...p, sector: v } : p))); }}
                            >
                              <option value="">Sin clasificar</option>
                              {SECTOR_NAMES.map((n) => <option key={n} value={n}>{n}</option>)}
                            </select>
                            <button
                              className="btn btn-icon btn-secondary"
                              style={{ width: 32, height: 32 }}
                              title={r.on ? "Excluir partida" : "Incluir partida"}
                              aria-label={r.on ? "Excluir partida" : "Incluir partida"}
                              onClick={() => setParts((ps) => ps.map((p) => (p.id === r.id ? { ...p, on: !p.on } : p)))}
                            >
                              {r.on ? <X size={15} strokeWidth={1.5} /> : <Plus size={15} strokeWidth={1.5} />}
                            </button>
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </div>
              </>
            )}

            <div className="row" style={{ gap: 8 }}>
              <input className="input" style={{ flex: "1 1 240px", width: "auto" }} value={nr.d} onChange={(e) => { setNr({ ...nr, d: e.target.value }); setErr(""); }} placeholder="Añadir una partida a mano: descripción" onKeyDown={(e) => e.key === "Enter" && addRow()} />
              <select className="input" aria-label="Unidad" style={{ width: 84, flex: "none" }} value={nr.u} onChange={(e) => setNr({ ...nr, u: e.target.value })}>
                {UNITS.map((u) => <option key={u}>{u}</option>)}
              </select>
              <input className="input" aria-label="Medición" style={{ width: 110, flex: "none" }} type="number" min={0} value={nr.q} onChange={(e) => setNr({ ...nr, q: e.target.value })} placeholder="Medición" />
              <button className="btn btn-secondary" style={{ flex: "none" }} onClick={addRow}>+ Añadir</button>
            </div>
          </>
        )}

        {W.step === 2 && (
          <>
            <h3>Condiciones de la puja</h3>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", gap: 16 }}>
              <Field label="Cierre de la puja">
                <input className="input" type="datetime-local" value={W.close} onChange={(e) => setWz("close", e.target.value)} />
              </Field>
            </div>
            {/* Pendiente: paquetes solo por invitación y filtro por zona de trabajo (ver src/server/eligibility.ts) */}
            <Field label="¿Quién puede pujar?">
              <span className="small">Todos los industriales verificados del sector que cumplan los requisitos de abajo.</span>
            </Field>
            <Field label="Valoración mínima del industrial">
              <Seg size="sm" options={["Cualquiera", "3+", "4+", "4,5+"] as const} labels={["Cualquiera", "3+ ★", "4+ ★", "4,5+ ★"]} value={W.min} onChange={(v) => setWz("min", v)} />
            </Field>
            <Field label="Certificados adicionales exigidos">
              <Chips options={EXTRA_CERTS} value={W.extra} onChange={(v) => setWz("extra", v)} label={(id) => CERTS[id].code + " · " + CERTS[id].name} />
              <div className="xs muted" style={{ marginTop: 6 }}>
                Cada paquete exige además REA y los certificados obligatorios de su sector (p. ej. Electricidad → IBT, Climatización → RITE y F-GAS).
              </div>
            </Field>
            <Field label="Derecho de tanteo (opcional)">
              <TanteoPicker value={W.tanteo} onChange={(v) => setWz("tanteo", v)} sectors={usedSecs} />
            </Field>
            <div className="small muted" style={{ paddingTop: 4, borderTop: "1px solid var(--color-divider)" }}>
              Puja ciega: cada industrial solo ve su propia oferta. Las ofertas se abren al cierre y el desglose por partidas es obligatorio.
            </div>
          </>
        )}

        {W.step === 3 && (
          <>
            <h3>Revisa antes de publicar</h3>
            <div className="cells" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))" }}>
              {summary.map(([k, v]) => (
                <div key={k} style={{ padding: "12px 14px" }}>
                  <div className="label">{k}</div>
                  <div style={{ fontWeight: 500 }}>{v}</div>
                </div>
              ))}
            </div>
            <h4 style={{ marginTop: 6 }}>
              {usedSecs.length === 1 ? "Se publicará 1 paquete de partidas" : "Se publicarán " + usedSecs.length + " paquetes, uno por sector"}
            </h4>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(min(100%,270px),1fr))", gap: 24 }}>
              {usedSecs.map((sec: Sector, i) => {
                const ps = inc.filter((p) => p.sector === sec);
                return (
                  <Blueprint key={sec} className="stack" style={{ padding: 16, gap: 10 }}>
                    <span className="mono">PAQUETE {pad(i + 1)} · {sec}</span>
                    <span className="figure" style={{ fontSize: 21, lineHeight: 1.1 }}>{TITLE[sec]}</span>
                    <div className="stack small muted" style={{ gap: 3 }}>
                      {ps.slice(0, 3).map((p) => <span key={p.id}>· {p.d}</span>)}
                      {ps.length > 3 && <span>y {ps.length - 3} más</span>}
                    </div>
                    <div className="row" style={{ gap: 4 }}>
                      <span className="xs muted">Exige</span>
                      {reqFor(sec, W.extra).map((r) => <span key={r} className="tag tag-outline">{CERTS[r].code}</span>)}
                    </div>
                    {W.tanteo.some((p) => p.trades.includes(sec)) && (
                      <span className="xs muted">
                        Derecho de tanteo: {W.tanteo.filter((p) => p.trades.includes(sec)).map((p) => p.name).join(", ")}
                      </span>
                    )}
                    <Field label="Presupuesto de referencia (opcional, solo lo ves tú)" style={{ marginTop: "auto" }}>
                      <input className="input" type="number" min={0} value={W.refs[sec] ?? ""} onChange={(e) => setWz("refs", { ...W.refs, [sec]: e.target.value })} placeholder="€ sin IVA" />
                    </Field>
                  </Blueprint>
                );
              })}
            </div>
          </>
        )}

        {err && <div className="err" role="alert">{err}</div>}
        <div className="row between" style={{ gap: 10, paddingTop: 6 }}>
          <button className="btn btn-secondary" onClick={back}>{W.step === 0 ? "Cancelar" : "← Atrás"}</button>
          <div className="row" style={{ gap: 10 }}>
            <button className="btn btn-ghost" onClick={saveDraft} disabled={pending}>Guardar borrador</button>
            <PrimaryButton className="btn-md" onClick={next} disabled={pending}>{W.step === 3 ? (pending ? "Publicando…" : "Publicar partidas") : "Continuar"}</PrimaryButton>
          </div>
        </div>
      </Blueprint>
    </div>
  );
}
