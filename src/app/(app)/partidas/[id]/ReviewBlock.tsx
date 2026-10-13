"use client";

import { useState, useTransition } from "react";
import { CATS } from "@/lib/catalog";
import { avg, dec1, stars } from "@/lib/format";
import { useUI } from "@/lib/store";
import { submitReview } from "@/server/actions/promotora";
import type { GivenReviewDTO } from "@/lib/types";
import { Blueprint, CatBars, PrimaryButton, StarInput } from "@/components/ui";

/** Valoración del adjudicatario: formulario si falta, o la valoración ya enviada. */
export function ReviewBlock({ tenderId, name, review }: { tenderId: string; name: string; review: GivenReviewDTO | null }) {
  const { flash } = useUI();
  const [pending, start] = useTransition();
  const [scores, setScores] = useState([0, 0, 0, 0]);
  const [comment, setComment] = useState("");
  const [err, setErr] = useState("");

  if (review) {
    const a = avg(review.r);
    return (
      <Blueprint className="stack" style={{ padding: "18px 20px", gap: 12, maxWidth: 720 }}>
        <div className="row between" style={{ gap: 8 }}>
          <h3>Tu valoración de {name}</h3>
          <span className="xs muted">{review.date}</span>
        </div>
        <div className="row" style={{ alignItems: "baseline", gap: 10 }}>
          <span className="figure" style={{ fontSize: 34, lineHeight: 1 }}>{dec1(a)}</span>
          <span className="stars" style={{ fontSize: 18 }}>{stars(a)}</span>
        </div>
        <CatBars r={review.r} labelWidth={72} lg />
        {review.comment && <p style={{ margin: 0 }}>“{review.comment}”</p>}
        <span className="xs muted">Las valoraciones no se pueden modificar. Cuentan en la media pública del industrial.</span>
      </Blueprint>
    );
  }

  const send = () => {
    if (scores.some((v) => !v)) return setErr("Puntúa las cuatro categorías.");
    const c = comment.trim();
    if (c && c.length < 10) return setErr("El comentario es demasiado corto (mínimo 10 caracteres), o déjalo vacío.");
    start(async () => {
      const r = await submitReview(tenderId, { quality: scores[0], deadlines: scores[1], cleanliness: scores[2], treatment: scores[3], comment: c });
      if (!r.ok) return setErr(r.error);
      flash(`Valoración enviada: ${dec1(r.avg)} ★ para ${r.name}`);
    });
  };

  return (
    <Blueprint className="stack" style={{ padding: "18px 20px", gap: 14, maxWidth: 720 }}>
      <div className="stack" style={{ gap: 2 }}>
        <h3>Valora a {name}</h3>
        <span className="small muted">Tu valoración ayuda a otras promotoras a elegir. Es pública en su perfil, junto con tu nombre y la obra.</span>
      </div>
      <div className="stack" style={{ gap: 6 }}>
        {CATS.map((c, k) => (
          <div key={c} className="row" style={{ gap: 12 }}>
            <span style={{ width: 80 }}>{c}</span>
            <StarInput label={c} value={scores[k]} onChange={(n) => { setScores((sc) => sc.map((v, j) => (j === k ? n : v))); setErr(""); }} />
          </div>
        ))}
      </div>
      <div className="field">
        <label htmlFor="review-comment">Comentario (opcional)</label>
        <textarea
          id="review-comment"
          className="input"
          maxLength={1000}
          value={comment}
          onChange={(e) => { setComment(e.target.value); setErr(""); }}
          placeholder="¿Cómo fue la obra? Cumplimiento de plazos, calidad del acabado, limpieza, coordinación…"
        />
      </div>
      {err && <div className="err" role="alert">{err}</div>}
      <div className="row between" style={{ gap: 10 }}>
        <span className="xs muted">Una vez enviada no se puede modificar. El industrial puede reportarla si la considera injusta.</span>
        <PrimaryButton className="btn-md" onClick={send} disabled={pending}>{pending ? "Enviando…" : "Enviar valoración"}</PrimaryButton>
      </div>
    </Blueprint>
  );
}
