"use client";

import { useTransition } from "react";
import Link from "next/link";
import { useUI } from "@/lib/store";
import { STATUS, unlockTxt } from "@/lib/catalog";
import { dateLabel, dot, eur, eur2, expTxt, stars } from "@/lib/format";
import { PILOT, TARIFF_TEXT } from "@/lib/pricing";
import { approveCertificate, approveCompany, rejectCertificate, rejectCompany, requestDocs, resolveReport } from "@/server/actions/admin";
import type { ActionResult, AdminDataDTO } from "@/lib/types";
import { Blueprint, CertBadge, PrimaryButton } from "@/components/ui";

import { ADMIN_TABS as TABS, type AdminTab as Tab } from "@/lib/routes";

const FEE_STATUS: Record<string, [string, string]> = {
  waived_pilot: ["Exenta · piloto", "tag tag-neutral"],
  pending: ["Pendiente", "tag tag-outline"],
  invoiced: ["Facturada", "tag tag-outline"],
  paid: ["Cobrada", "tag tag-accent"],
  cancelled: ["Anulada", "tag tag-neutral"],
};

export function AdminPanel({ data, tab }: { data: AdminDataDTO; tab: Tab }) {
  const { flash } = useUI();
  const [pending, start] = useTransition();

  /** Ejecuta una acción y muestra el resultado en el toast. */
  const run = <T extends object>(action: () => Promise<ActionResult<T>>, msg: (r: T) => string) =>
    start(async () => {
      const r = await action();
      flash(r.ok ? msg(r) : r.error);
    });

  const kpis: [string, number][] = [
    ["Empresas por verificar", data.kpis.verifs],
    ["Partidas abiertas", data.kpis.open],
    ["Pujas · últimos 7 días", data.kpis.bids7d],
    ["Valoraciones reportadas", data.kpis.flagged],
  ];
  const labels: Record<Tab, string> = {
    verificaciones: "Verificaciones · " + data.verifs.length,
    certificados: "Certificados · " + data.pendingCerts.length,
    partidas: "Partidas",
    valoraciones: "Valoraciones reportadas · " + data.flagged.length,
    comisiones: "Comisiones",
  };

  return (
    <div className="stack" style={{ gap: 24 }} aria-busy={pending}>
      <div>
        <div className="kicker">Administración BID</div>
        <h1 style={{ marginTop: 2 }}>Panel</h1>
      </div>

      <Blueprint className="facts" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))" }}>
        {kpis.map(([k, v]) => (
          <div key={k} className="fact" style={{ padding: "16px 18px" }}>
            <div className="label">{k}</div>
            <div className="figure" style={{ fontSize: 38, lineHeight: 1.1 }}>{v}</div>
          </div>
        ))}
      </Blueprint>

      <nav style={{ display: "flex", gap: 2, borderBottom: "1px solid var(--color-divider)", overflowX: "auto" }}>
        {TABS.map((k) => (
          <Link key={k} href={"/admin/" + k} className="tabbtn lg" aria-current={k === tab ? "page" : undefined}>
            {labels[k]}
          </Link>
        ))}
      </nav>

      {tab === "verificaciones" && (
        <div className="stack" style={{ gap: 18 }}>
          {data.verifs.map((x) => {
            const missing = x.docs.filter((d) => !d.ok).map((d) => d.kind);
            return (
              <Blueprint key={x.id} className="row between" style={{ gap: "14px 24px", padding: "16px 18px" }}>
                <div className="stack" style={{ gap: 4, minWidth: 220 }}>
                  <div className="row" style={{ gap: 8 }}>
                    <span className="figure" style={{ fontSize: 20 }}>{x.name}</span>
                    <span className="tag tag-neutral">{x.type}</span>
                  </div>
                  <span className="small muted">CIF {x.cif} · {x.prov} · solicitado {x.date}</span>
                </div>
                <div className="row" style={{ gap: 6 }}>
                  {x.docs.map((d) =>
                    d.ok && d.url ? (
                      <a key={d.kind} className="tag tag-neutral" href={d.url} target="_blank" rel="noreferrer" style={{ textDecoration: "none" }}>{d.kind} ✓</a>
                    ) : (
                      <span key={d.kind} className={d.ok ? "tag tag-neutral" : "tag tag-outline"}>{d.ok ? d.kind + " ✓" : "Falta " + d.kind}</span>
                    ),
                  )}
                </div>
                <div className="row" style={{ gap: 8 }}>
                  <button className="btn btn-secondary" disabled={pending} onClick={() => run(() => rejectCompany(x.id), (r) => "Solicitud de " + r.name + " rechazada.")}>Rechazar</button>
                  {missing.length ? (
                    <button className="btn btn-secondary" disabled={pending} onClick={() => run(() => requestDocs(x.id), (r) => "Solicitud de " + r.missing.join(", ") + " enviada a " + dot(r.name))}>
                      Solicitar {missing.join(", ")}
                    </button>
                  ) : (
                    <button className="btn btn-primary" disabled={pending} onClick={() => run(() => approveCompany(x.id), (r) => r.name + " verificada.")}>Aprobar</button>
                  )}
                </div>
              </Blueprint>
            );
          })}
          {data.verifs.length === 0 && <p className="muted">No hay empresas pendientes de verificar.</p>}
        </div>
      )}

      {tab === "certificados" && (
        <div className="stack" style={{ gap: 18 }}>
          {data.pendingCerts.map(({ companyId, companyName, cert, pdf }) => (
            <Blueprint key={companyId + cert.id} className="row between" style={{ gap: "14px 24px", padding: "16px 18px" }}>
              <CertBadge cert={cert} meta={companyName + " · caduca " + expTxt(cert.exp)} />
              <span className="small muted" style={{ flex: "1 1 200px" }}>
                {unlockTxt(cert.id)} ·{" "}
                {pdf ? <a href={pdf} target="_blank" rel="noreferrer">PDF adjunto</a> : "PDF adjunto"}
              </span>
              <div className="row" style={{ gap: 8 }}>
                <button className="btn btn-secondary" disabled={pending} onClick={() => run(() => rejectCertificate(companyId, cert.id), (r) => r.code + " rechazado. Se ha avisado a " + dot(r.name))}>
                  Rechazar
                </button>
                <button className="btn btn-primary" disabled={pending} onClick={() => run(() => approveCertificate(companyId, cert.id), (r) => r.code + " validado para " + dot(r.name))}>
                  Validar
                </button>
              </div>
            </Blueprint>
          ))}
          {data.pendingCerts.length === 0 && <p className="muted">No hay certificados pendientes de validar.</p>}
        </div>
      )}

      {tab === "partidas" && (
        <div className="scroll-x">
          <table className="table" style={{ minWidth: 820 }}>
            <thead>
              <tr><th>ID</th><th>Trabajo</th><th>Promotora</th><th>Provincia</th><th>Estado</th><th className="r">Pujas</th><th>Cierre</th></tr>
            </thead>
            <tbody>
              {data.tenders.map((t) => (
                <tr key={t.id}>
                  <td style={{ font: "500 12px ui-monospace,Menlo,monospace" }}>{t.id}</td>
                  <td>{t.title}</td>
                  <td>{t.owner}</td>
                  <td>{t.prov}</td>
                  <td><span className={STATUS[t.status][1]}>{STATUS[t.status][0]}</span></td>
                  <td className="r num">{t.n}</td>
                  <td>{dateLabel(t.closesAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === "comisiones" && (
        <div className="stack" style={{ gap: 18 }}>
          <div className="row between" style={{ alignItems: "baseline", gap: 8 }}>
            <span className="small muted">Tarifa: {TARIFF_TEXT}, a cargo del industrial adjudicatario.</span>
            {PILOT && <span className="tag tag-outline">Piloto · no se cobra</span>}
          </div>
          <Blueprint className="facts" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))" }}>
            {(
              [
                ["Adjudicaciones", String(data.fees.totals.n)],
                ["Importe adjudicado", eur(data.fees.totals.awarded)],
                [PILOT ? "Comisión que se habría cobrado" : "Comisión devengada", eur(data.fees.totals.fee)],
                ["Cobrado", eur(data.fees.totals.charged)],
              ] as [string, string][]
            ).map(([k, v]) => (
              <div key={k} className="fact" style={{ padding: "16px 18px" }}>
                <div className="label">{k}</div>
                <div className="figure" style={{ fontSize: 30, lineHeight: 1.1 }}>{v}</div>
              </div>
            ))}
          </Blueprint>
          {data.fees.rows.length > 0 ? (
            <div className="scroll-x">
              <table className="table" style={{ minWidth: 860 }}>
                <thead>
                  <tr><th>ID</th><th>Trabajo</th><th>Promotora</th><th>Adjudicatario</th><th>Fecha</th><th className="r">Importe</th><th className="r">Comisión</th><th>Estado</th></tr>
                </thead>
                <tbody>
                  {data.fees.rows.map((f) => (
                    <tr key={f.tenderId}>
                      <td style={{ font: "500 12px ui-monospace,Menlo,monospace" }}>{f.tenderId}</td>
                      <td>{f.title}</td>
                      <td>{f.owner}</td>
                      <td>{f.industrial}</td>
                      <td>{f.date}</td>
                      <td className="r num">{eur(f.total)}</td>
                      <td className="r num" style={{ fontWeight: 500 }}>{eur2(f.fee)}</td>
                      <td><span className={FEE_STATUS[f.status][1]}>{FEE_STATUS[f.status][0]}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="muted">Aún no hay adjudicaciones.</p>
          )}
        </div>
      )}

      {tab === "valoraciones" && (
        <div className="stack" style={{ gap: 18 }}>
          {data.flagged.map((f) => (
            <Blueprint key={f.id} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: "14px 28px", padding: "16px 18px" }}>
              <div className="stack" style={{ gap: 4 }}>
                <span className="xs muted">{f.by} → {f.ind} · {f.obra}</span>
                <span className="stars">{stars(f.score)} <span style={{ color: "var(--color-text)" }}>{f.score.toFixed(1)}</span></span>
                <p style={{ margin: 0 }}>“{f.text}”</p>
              </div>
              <div className="stack between" style={{ gap: 10 }}>
                <div className="small" style={{ padding: "10px 12px", background: "var(--color-neutral-200)" }}>
                  <b style={{ fontWeight: 500 }}>Motivo del reporte:</b> {f.reason}
                </div>
                <div className="row" style={{ gap: 8, justifyContent: "flex-end" }}>
                  <button className="btn btn-secondary" disabled={pending} onClick={() => run(() => resolveReport(f.id, true), (r) => "Valoración ocultada del perfil de " + dot(r.ind))}>Ocultar valoración</button>
                  <PrimaryButton disabled={pending} onClick={() => run(() => resolveReport(f.id, false), () => "Valoración mantenida. Se ha informado al industrial.")}>Mantener</PrimaryButton>
                </div>
              </div>
            </Blueprint>
          ))}
          {data.flagged.length === 0 && <p className="muted">No hay valoraciones reportadas.</p>}
        </div>
      )}
    </div>
  );
}

