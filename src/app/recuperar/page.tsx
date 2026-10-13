"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requestPasswordReset } from "@/server/actions/auth";
import { AuthFrame } from "@/components/AuthFrame";
import { Field, PrimaryButton } from "@/components/ui";

export default function RecuperarPage() {
  const [email, setEmail] = useState("");
  const [err, setErr] = useState("");
  const [sent, setSent] = useState(false);
  const [pending, start] = useTransition();

  return (
    <AuthFrame>
      <form
        className="stack"
        style={{ gap: 16 }}
        onSubmit={(e) => {
          e.preventDefault();
          start(async () => {
            const r = await requestPasswordReset(email);
            if (!r.ok) return setErr(r.error);
            setSent(true);
          });
        }}
      >
        <Link href="/login" className="btn btn-ghost" style={{ alignSelf: "flex-start" }}><ArrowLeft size={15} strokeWidth={1.5} /> Acceso</Link>
        <div>
          <div className="kicker">Recuperar contraseña</div>
          <h1 style={{ margin: "4px 0 6px", fontSize: 32 }}>¿Has olvidado tu contraseña?</h1>
        </div>
        {sent ? (
          <p className="muted" style={{ margin: 0 }} role="status">
            Si hay una cuenta con <b style={{ fontWeight: 500, color: "var(--color-text)" }}>{email.trim()}</b>, te hemos enviado un enlace para elegir una contraseña nueva. Caduca en 1 hora. Revisa también la carpeta de spam.
          </p>
        ) : (
          <>
            <p className="muted" style={{ margin: 0 }}>Escribe el email con el que entras en BID y te enviaremos un enlace para elegir una contraseña nueva.</p>
            <Field label="Email">
              <input className="input" type="email" autoComplete="email" required value={email} onChange={(e) => { setEmail(e.target.value); setErr(""); }} />
            </Field>
            {err && <div className="err" role="alert">{err}</div>}
            <PrimaryButton type="submit" className="btn-lg" disabled={pending}>{pending ? "Enviando…" : "Enviar enlace"}</PrimaryButton>
          </>
        )}
      </form>
    </AuthFrame>
  );
}
