"use client";

import { useState, useTransition } from "react";
import { avg, dec1, stars } from "@/lib/format";
import { CATS } from "@/lib/catalog";
import { useUI } from "@/lib/store";
import { reportReview } from "@/server/actions/industrial";
import type { ReceivedReviewDTO } from "@/lib/types";
import { Blueprint } from "@/components/ui";

const REPORT_LABEL: Record<NonNullable<ReceivedReviewDTO["report"]>["status"], [string, string]> = {
  open: ["Reportada · en revisión", "tag tag-outline"],
  kept: ["Revisada · se mantiene", "tag tag-neutral"],
  hidden: ["Ocultada tras revisión", "tag tag-accent"],
};

export function ReceivedReviews({ reviews }: { reviews: ReceivedReviewDTO[] }) {
  const { flash } = useUI();
  const [pending, start] = useTransition();
  const [reporting, setReporting] = useState<ReceivedReviewDTO | null>(null);
  const [reason, setReason] = useState("");
  const [err, setErr] = useState("");
  const [onlyComments, setOnlyComments] = useState(true);

  const shown = onlyComments ? reviews.filter((r) => r.text) : reviews;
  const withoutText = reviews.length - reviews.filter((r) => r.text).length;

  const send = () => {
    if (!reporting) return;
    if (reason.trim().length < 20) return setErr("Explica el motivo con un poco más de detalle (mínimo 20 caracteres).");
    start(async () => {
      const r = await reportReview(reporting.id, reason);
      if (!r.ok) return setErr(r.error);
      setReporting(null);
      setReason("");
      flash("Valoración reportada. El equipo de Bidra la revisará y te avisaremos.");
    });
  };

  return (
    <div className="stack" style={{ gap: 14 }}>
      <div className="row between" style={{ alignItems: "baseline", gap: 8 }}>
        <h3>Valoraciones recibidas</h3>
        {withoutText > 0 && (
          <button type="button" className="btn btn-ghost" onClick={() => setOnlyComments((v) => !v)}>
            {onlyComments ? `Ver también las ${withoutText} sin comentario` : "Ver solo las que tienen comentario"}
          </button>
        )}
      </div>
      {reviews.length === 0 && <p className="muted" style={{ margin: 0 }}>Aún no tienes valoraciones. Llegarán cuando las promotoras valoren las obras que te adjudiquen.</p>}
      <div className="stack" style={{ gap: 0, maxWidth: 880 }}>
        {shown.map((r) => {
          const a = avg(r.r);
          const rep = r.report ? REPORT_LABEL[r.report.status] : null;
          return (
            <div key={r.id} className="stack" style={{ gap: 6, padding: "14px 0", borderBottom: "1px solid var(--color-divider)", opacity: r.hidden ? 0.6 : 1 }}>
              <div className="row between xs muted" style={{ gap: 8 }}>
                <span>{r.by} · {r.obra}{r.tenderId ? ` · ${r.tenderId}` : ""}</span>
                <span>{r.date}</span>
              </div>
              <div className="row" style={{ gap: "4px 14px" }}>
                <span className="stars">{stars(a)} <span style={{ color: "var(--color-text)", fontSize: 13 }}>{dec1(a)}</span></span>
                <span className="xs muted">{CATS.map((c, k) => `${c} ${dec1(r.r[k])}`).join(" · ")}</span>
              </div>
              {r.text && <div style={{ fontSize: 14 }}>{r.text}</div>}
              <div className="row" style={{ gap: 8 }}>
                {rep ? (
                  <span className={rep[1]}>{rep[0]}</span>
                ) : r.hidden ? (
                  <span className="tag tag-neutral">Oculta</span>
                ) : (
                  <button type="button" className="btn btn-ghost" style={{ marginLeft: -4 }} onClick={() => { setReporting(r); setErr(""); }}>
                    Reportar valoración
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {reporting && (
        <div className="dialog-backdrop" onClick={() => !pending && setReporting(null)}>
          <Blueprint className="dialog" role="dialog" aria-modal="true" onClick={(e: React.MouseEvent) => e.stopPropagation()}>
            <div className="dialog-title">Reportar valoración</div>
            <div className="dialog-body stack" style={{ gap: 10 }}>
              <span className="small muted">{reporting.by} · {reporting.obra} · {dec1(avg(reporting.r))} ★</span>
              <span>El equipo de Bidra revisará la valoración y decidirá si se mantiene o se oculta de tu perfil. Solo puedes reportarla una vez.</span>
              <div className="field">
                <label htmlFor="report-reason">Motivo</label>
                <textarea
                  id="report-reason"
                  className="input"
                  maxLength={1000}
                  value={reason}
                  onChange={(e) => { setReason(e.target.value); setErr(""); }}
                  placeholder="Explica qué no es correcto y aporta contexto (p. ej. un cambio de proyecto, trabajos de otra empresa…)."
                  autoFocus
                />
              </div>
              {err && <div className="err" role="alert">{err}</div>}
            </div>
            <div className="dialog-actions">
              <button className="btn btn-secondary" onClick={() => setReporting(null)} disabled={pending}>Cancelar</button>
              <button className="btn btn-primary" onClick={send} disabled={pending}>{pending ? "Enviando…" : "Enviar reporte"}</button>
            </div>
          </Blueprint>
        </div>
      )}
    </div>
  );
}
