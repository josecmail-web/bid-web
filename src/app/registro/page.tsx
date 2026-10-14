"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { PROVINCES, TRADES } from "@/lib/catalog";
import { dot } from "@/lib/format";
import { EMAIL_RE, passwordError, requiredDocs } from "@/lib/rules";
import { validateTaxId } from "@/lib/taxid";
import { register } from "@/server/actions/auth";
import type { Sector } from "@/lib/types";
import { AuthFrame } from "@/components/AuthFrame";
import { Blueprint, Chips, Field, PrimaryButton, Seg } from "@/components/ui";

type Step = "type" | "company" | "detail" | "docs" | "done";
const STEPS: Step[] = ["type", "company", "detail", "docs"];

const KINDS = ["Promotora", "Constructora", "Ambas"] as const;
const VOLUMES = ["< 5 M€", "5–20 M€", "20–50 M€", "> 50 M€"] as const;
const RADII = ["Provincia", "Comunidad", "Nacional"] as const;

interface Reg {
  type: "" | "promotora" | "industrial";
  name: string;
  cif: string;
  prov: string;
  email: string;
  pass: string;
  kind: (typeof KINDS)[number];
  vol: (typeof VOLUMES)[number];
  trades: Sector[];
  radius: (typeof RADII)[number];
  docs: Record<string, File>;
}

const TYPE_OPTS = [
  ["promotora", "Promotora o constructora", "Publica trabajos y partidas, recibe presupuestos ciegos y adjudica."],
  ["industrial", "Industrial de la construcción", "Puja con tu presupuesto por los trabajos de tu oficio y acumula valoraciones."],
] as const;

export default function RegistroPage() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [home, setHome] = useState("/");
  const fileRef = useRef<HTMLInputElement>(null);
  const [pickFor, setPickFor] = useState("");
  const [terms, setTerms] = useState(false);
  const [step, setStep] = useState<Step>("type");
  const [err, setErr] = useState("");
  const [reg, setRegState] = useState<Reg>({
    type: "", name: "", cif: "", prov: "Valencia", email: "", pass: "",
    kind: "Promotora", vol: "5–20 M€", trades: [], radius: "Provincia", docs: {},
  });
  const set = <K extends keyof Reg>(k: K, v: Reg[K]) => {
    setRegState((r) => ({ ...r, [k]: v }));
    setErr("");
  };

  const docList = requiredDocs(reg.type === "industrial" ? "industrial" : "promotora");

  const validate = () => {
    if (step === "type" && !reg.type) return "Elige un tipo de cuenta.";
    if (step === "company") {
      if (!reg.name.trim()) return "Indica la razón social.";
      const tax = validateTaxId(reg.cif);
      if (!tax.ok) return tax.error;
      if (!EMAIL_RE.test(reg.email.trim())) return "Introduce un email válido.";
      const pw = passwordError(reg.pass, reg.email.trim());
      if (pw) return pw;
    }
    if (step === "detail" && reg.type === "industrial" && !reg.trades.length) return "Selecciona al menos un oficio.";
    if (step === "docs" && docList.some(([d]) => !reg.docs[d])) return "Faltan documentos por subir.";
    if (step === "docs" && !terms) return "Acepta las condiciones de uso para continuar.";
    return "";
  };

  const next = () => {
    if (step === "done") {
      router.replace(home);
      return router.refresh();
    }
    const e = validate();
    if (e) return setErr(e);
    setErr("");
    if (step !== "docs") return setStep(STEPS[STEPS.indexOf(step) + 1]);
    const fd = new FormData();
    for (const k of ["type", "name", "cif", "prov", "email", "pass", "kind", "vol", "radius"] as const) fd.set(k, reg[k]);
    fd.set("trades", JSON.stringify(reg.trades));
    fd.set("terms", terms ? "1" : "");
    for (const [k, f] of Object.entries(reg.docs)) fd.set("doc:" + k, f);
    start(async () => {
      const res = await register(fd);
      if (!res.ok) return setErr(res.error);
      setHome(res.home);
      setStep("done");
    });
  };

  const back = () => {
    const i = STEPS.indexOf(step);
    if (step === "done") return;
    if (i <= 0) return router.push("/login");
    setStep(STEPS[i - 1]);
    setErr("");
  };

  const si = step === "done" ? 4 : STEPS.indexOf(step) + 1;

  return (
    <AuthFrame>
      <form
        className="stack"
        style={{ gap: 18 }}
        onSubmit={(e) => {
          e.preventDefault();
          next();
        }}
      >
        <div className="row between" style={{ gap: 12 }}>
          <button type="button" className="btn btn-ghost" onClick={back} disabled={step === "done" || pending}>
            <ArrowLeft size={15} strokeWidth={1.5} /> Atrás
          </button>
          <span style={{ fontSize: 12, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--color-neutral-700)" }}>
            Paso {Math.min(si, 4)} de 4
          </span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 4 }}>
          {[1, 2, 3, 4].map((n) => (
            <div key={n} style={{ height: 3, background: n <= si ? "var(--color-accent)" : "var(--color-neutral-300)" }} />
          ))}
        </div>

        {step === "type" && (
          <>
            <h2 style={{ fontSize: 30 }}>¿Cómo vas a usar Bidra?</h2>
            <div style={{ display: "grid", gap: 14 }}>
              {TYPE_OPTS.map(([k, title, desc]) => {
                const on = reg.type === k;
                return (
                  <Blueprint
                    key={k}
                    as="button"
                    type="button"
                    aria-pressed={on}
                    onClick={() => set("type", k)}
                    className="card-btn stack"
                    style={{
                      padding: 18, gap: 4,
                      background: on ? "color-mix(in srgb, var(--color-accent) 10%, transparent)" : undefined,
                      borderColor: on ? "var(--color-accent)" : undefined,
                    }}
                  >
                    <span className="figure" style={{ fontSize: 22 }}>{title}</span>
                    <span className="muted" style={{ fontSize: 14 }}>{desc}</span>
                  </Blueprint>
                );
              })}
            </div>
          </>
        )}

        {step === "company" && (
          <>
            <h2 style={{ fontSize: 30 }}>Datos de la empresa</h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 14 }}>
              <Field label="Razón social" style={{ gridColumn: "1/-1" }}>
                <input className="input" value={reg.name} onChange={(e) => set("name", e.target.value)} placeholder="Construcciones Ejemplo S.L." />
              </Field>
              <Field label="CIF / NIF">
                <input className="input" value={reg.cif} onChange={(e) => set("cif", e.target.value)} placeholder="B12345674" />
              </Field>
              <Field label="Provincia">
                <select className="input" value={reg.prov} onChange={(e) => set("prov", e.target.value)}>
                  {PROVINCES.map((p) => <option key={p}>{p}</option>)}
                </select>
              </Field>
              <Field label="Email de contacto">
                <input className="input" type="email" value={reg.email} onChange={(e) => set("email", e.target.value)} placeholder="obras@empresa.es" />
              </Field>
              <Field label="Contraseña (mín. 8)">
                <input className="input" type="password" autoComplete="new-password" value={reg.pass} onChange={(e) => set("pass", e.target.value)} />
              </Field>
            </div>
          </>
        )}

        {step === "detail" && reg.type === "promotora" && (
          <>
            <h2 style={{ fontSize: 30 }}>Perfil de la empresa</h2>
            <Field label="Actividad"><Seg options={KINDS} value={reg.kind} onChange={(v) => set("kind", v)} /></Field>
            <Field label="Volumen de obra anual"><Seg options={VOLUMES} value={reg.vol} onChange={(v) => set("vol", v)} /></Field>
          </>
        )}

        {step === "detail" && reg.type === "industrial" && (
          <>
            <h2 style={{ fontSize: 30 }}>Oficios y zona</h2>
            <Field label="Oficios en los que vas a pujar"><Chips options={TRADES} value={reg.trades} onChange={(v) => set("trades", v)} /></Field>
            <Field label="Radio de trabajo"><Seg options={RADII} value={reg.radius} onChange={(v) => set("radius", v)} /></Field>
          </>
        )}

        {step === "docs" && (
          <>
            <h2 style={{ fontSize: 30 }}>Documentación para verificar</h2>
            <p className="muted" style={{ margin: 0, fontSize: 14 }}>
              {reg.type === "industrial"
                ? "El equipo de Bidra revisa cada empresa antes de que pueda pujar. Los certificados ISO y de instalador los añadirás después desde tu perfil."
                : "El equipo de Bidra revisa cada empresa antes de que pueda publicar."}
            </p>
            <div className="stack" style={{ gap: 10 }}>
              {docList.map(([k, hint]) => {
                const f = reg.docs[k];
                return (
                  <div key={k} className="row between" style={{ gap: 12, padding: "12px 14px", border: "1px solid var(--color-divider)", flexWrap: "nowrap" }}>
                    <div className="stack" style={{ minWidth: 0 }}>
                      <span style={{ fontWeight: 500 }}>{k}</span>
                      <span className="xs muted" style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{f ? f.name : hint}</span>
                    </div>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      style={{ flex: "none", color: f ? "var(--color-accent-700)" : undefined }}
                      onClick={() => {
                        setPickFor(k);
                        fileRef.current?.click();
                      }}
                    >
                      {f ? "Subido ✓" : "Subir PDF"}
                    </button>
                  </div>
                );
              })}
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="application/pdf,.pdf"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) {
                  if (!f.name.toLowerCase().endsWith(".pdf")) setErr("El documento debe ser un PDF.");
                  else if (f.size > 10 * 1024 * 1024) setErr(f.name + " supera los 10 MB.");
                  else {
                    setRegState((r) => ({ ...r, docs: { ...r.docs, [pickFor]: f } }));
                    setErr("");
                  }
                }
                e.target.value = "";
              }}
            />
          </>
        )}

        {step === "docs" && (
          <label className="row small" style={{ gap: 10, flexWrap: "nowrap", alignItems: "flex-start", cursor: "pointer" }}>
            <input type="checkbox" checked={terms} onChange={(e) => { setTerms(e.target.checked); setErr(""); }} style={{ marginTop: 3, accentColor: "var(--color-accent)" }} />
            <span>
              He leído y acepto las <Link href="/condiciones" target="_blank">condiciones de uso</Link>
              {reg.type === "industrial" ? ", incluida la comisión por adjudicación (exenta durante el piloto)." : "."}
            </span>
          </label>
        )}

        {step === "done" && (
          <>
            <div className="kicker">Solicitud enviada</div>
            <h2 style={{ fontSize: 30 }}>{reg.name} está en revisión</h2>
            <p className="muted" style={{ margin: 0 }}>
              Validamos CIF y documentación en 24–48 h laborables. Te avisaremos en {dot(reg.email)}
            </p>
          </>
        )}

        {err && <div className="err" role="alert">{err}</div>}
        <PrimaryButton type="submit" className="btn-lg" disabled={pending}>
          {step === "docs" ? (pending ? "Enviando…" : "Enviar a verificación") : step === "done" ? "Entrar en Bidra" : "Continuar"}
        </PrimaryButton>
      </form>
    </AuthFrame>
  );
}
