"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useUI } from "@/lib/store";
import { demoLogin, login, resetDemo } from "@/server/actions/auth";
import { Field, PrimaryButton } from "@/components/ui";
import { AuthFrame } from "@/components/AuthFrame";

const DEMO_EMAIL = "compras@grupolevante.es";
const DEMO_PASS = "bid-demo-2026";

export function LoginForm({ demo }: { demo: boolean }) {
  const { flash } = useUI();
  const router = useRouter();
  const [email, setEmail] = useState(demo ? DEMO_EMAIL : "");
  const [pass, setPass] = useState(demo ? DEMO_PASS : "");
  const [err, setErr] = useState("");
  const [pending, start] = useTransition();

  const go = (res: Awaited<ReturnType<typeof login>>) => {
    if (!res.ok) return setErr(res.error);
    router.replace(res.home);
    router.refresh();
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    start(async () => go(await login(email, pass)));
  };

  return (
    <AuthFrame
      extra={
        demo && (
          <button
            type="button"
            className="btn btn-ghost"
            style={{ marginTop: 8, fontSize: 12, color: "var(--color-neutral-600)" }}
            disabled={pending}
            onClick={() =>
              start(async () => {
                const r = await resetDemo();
                flash(r.ok ? "Datos de demostración restablecidos." : r.error);
              })
            }
          >
            Restablecer datos de demo
          </button>
        )
      }
    >
      <form className="stack" style={{ gap: 16 }} onSubmit={submit}>
        <div>
          <div className="kicker">Acceso</div>
          <h1 style={{ margin: "4px 0 6px", fontSize: 36 }}>Partidas de obra a puja ciega</h1>
          <p className="muted" style={{ margin: 0, textWrap: "pretty" }}>
            Promotoras y constructoras publican partidas; los industriales verificados envían su presupuesto sin ver el de los demás.
          </p>
        </div>
        <Field label="Email">
          <input className="input" type="email" autoComplete="email" required value={email} onChange={(e) => { setEmail(e.target.value); setErr(""); }} />
        </Field>
        <Field label="Contraseña">
          <input className="input" type="password" autoComplete="current-password" required value={pass} onChange={(e) => { setPass(e.target.value); setErr(""); }} />
        </Field>
        <Link href="/recuperar" className="xs" style={{ alignSelf: "flex-end", marginTop: -8 }}>¿Has olvidado tu contraseña?</Link>
        {err && <div className="err" role="alert">{err}</div>}
        <PrimaryButton type="submit" className="btn-lg" disabled={pending}>{pending ? "Entrando…" : "Entrar"}</PrimaryButton>
        <div className="row between" style={{ gap: 8, fontSize: 14 }}>
          <Link className="btn btn-ghost" href="/registro">Crear cuenta de empresa →</Link>
          {demo && (
            <button type="button" className="btn btn-ghost" style={{ color: "var(--color-neutral-700)" }} disabled={pending} onClick={() => start(async () => go(await demoLogin("admin")))}>
              Entrar como administrador
            </button>
          )}
        </div>
      </form>
    </AuthFrame>
  );
}
