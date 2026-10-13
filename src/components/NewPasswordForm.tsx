"use client";

import { useState, useTransition } from "react";
import { passwordError } from "@/lib/rules";
import type { ActionResult } from "@/lib/types";
import { Field, PrimaryButton } from "./ui";

/** Contraseña nueva + repetición, con las mismas reglas que el servidor. */
export function NewPasswordForm({
  email,
  submitLabel,
  onSubmit,
  onDone,
  requireTerms = false,
}: {
  email: string;
  submitLabel: string;
  /** muestra y exige la casilla de condiciones de uso */
  requireTerms?: boolean;
  onSubmit: (password: string) => Promise<ActionResult>;
  onDone: () => void;
}) {
  const [p1, setP1] = useState("");
  const [p2, setP2] = useState("");
  const [err, setErr] = useState("");
  const [pending, start] = useTransition();
  const [terms, setTerms] = useState(false);

  return (
    <form
      className="stack"
      style={{ gap: 14 }}
      onSubmit={(e) => {
        e.preventDefault();
        const bad = passwordError(p1, email);
        if (bad) return setErr(bad);
        if (p1 !== p2) return setErr("Las contraseñas no coinciden.");
        if (requireTerms && !terms) return setErr("Acepta las condiciones de uso para continuar.");
        start(async () => {
          const r = await onSubmit(p1);
          if (!r.ok) return setErr(r.error);
          onDone();
        });
      }}
    >
      {/* el gestor de contraseñas asocia la nueva clave a este usuario */}
      <input type="email" autoComplete="username" value={email} readOnly hidden />
      <Field label="Contraseña nueva (mín. 8)">
        <input className="input" type="password" autoComplete="new-password" value={p1} onChange={(e) => { setP1(e.target.value); setErr(""); }} />
      </Field>
      <Field label="Repite la contraseña">
        <input className="input" type="password" autoComplete="new-password" value={p2} onChange={(e) => { setP2(e.target.value); setErr(""); }} />
      </Field>
      {requireTerms && (
        <label className="row small" style={{ gap: 10, flexWrap: "nowrap", alignItems: "flex-start", cursor: "pointer" }}>
          <input type="checkbox" checked={terms} onChange={(e) => { setTerms(e.target.checked); setErr(""); }} style={{ marginTop: 3, accentColor: "var(--color-accent)" }} />
          <span>He leído y acepto las <a href="/condiciones" target="_blank">condiciones de uso</a>.</span>
        </label>
      )}
      {err && <div className="err" role="alert">{err}</div>}
      <PrimaryButton type="submit" className="btn-lg" disabled={pending}>{pending ? "Guardando…" : submitLabel}</PrimaryButton>
    </form>
  );
}
