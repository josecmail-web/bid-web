"use client";

import { useRef, useState, useTransition } from "react";
import { readImage, useUI } from "@/lib/store";
import { CERTS, CERT_IDS, SECTOR_NAMES, reqFor, unlockTxt } from "@/lib/catalog";
import { avg, dec1, expired, expiresSoon } from "@/lib/format";
import { addCertificate, setCertificateLogo } from "@/server/actions/industrial";
import type { CertDTO, CertId, IndustrialProfileDTO } from "@/lib/types";
import { Blueprint, CertBadge, Field, PrimaryButton } from "@/components/ui";

const ST: Record<CertDTO["st"], [string, string]> = {
  ok: ["Verificado", "tag tag-accent"],
  pending: ["En revisión", "tag tag-neutral"],
  rejected: ["Rechazado", "tag tag-outline"],
};

type NewCert = { id: CertId | ""; exp: string; logo: string; logoFile: File | null; pdf: File | null };
const emptyNc: NewCert = { id: "", exp: "", logo: "", logoFile: null, pdf: null };

export function IndustrialProfile({ me, mine }: { me: IndustrialProfileDTO; mine: CertDTO[] }) {
  const { flash, openProfile } = useUI();
  const [pending, start] = useTransition();
  // Un certificado caducado deja de dar acceso
  const okIds = mine.filter((c) => c.st === "ok" && !expired(c.exp)).map((c) => c.id);

  const [nc, setNc] = useState<NewCert>(emptyNc);
  const [ncErr, setNcErr] = useState("");
  const pdfRef = useRef<HTMLInputElement>(null);

  const options = CERT_IDS.filter((id) => !mine.some((c) => c.id === id && c.st !== "rejected"));

  const changeLogo = (certType: CertId, file: File) => {
    const fd = new FormData();
    fd.set("certType", certType);
    fd.set("logo", file);
    start(async () => {
      const r = await setCertificateLogo(fd);
      flash(r.ok ? "Logotipo actualizado." : r.error);
    });
  };

  const submit = () => {
    if (!nc.id) return setNcErr("Elige el tipo de certificado.");
    if (!nc.exp) return setNcErr("Indica la fecha de caducidad.");
    if (!nc.pdf) return setNcErr("Adjunta el certificado en PDF para que podamos validarlo.");
    const id = nc.id;
    const fd = new FormData();
    fd.set("certType", id);
    fd.set("exp", nc.exp);
    fd.set("pdf", nc.pdf);
    if (nc.logoFile) fd.set("logo", nc.logoFile);
    start(async () => {
      const r = await addCertificate(fd);
      if (!r.ok) return setNcErr(r.error);
      setNc(emptyNc);
      setNcErr("");
      flash(CERTS[id].code + " enviado. BID lo validará en 24–48 h.");
    });
  };

  return (
    <div className="stack" style={{ gap: 30 }}>
      <div className="row between" style={{ alignItems: "flex-end", gap: 16 }}>
        <div>
          <div className="kicker">Industrial · {me.trades.join(", ") || "Sin oficios"}</div>
          <h1 style={{ marginTop: 2 }}>{me.name}</h1>
          <div className="muted">{me.city} · {me.jobs} obras · {me.r ? dec1(avg(me.r)) : "—"} ★</div>
        </div>
        <button className="btn btn-secondary" onClick={() => openProfile(me.id)}>Ver mi perfil público</button>
      </div>

      <div className="stack" style={{ gap: 12 }}>
        <div className="row between" style={{ alignItems: "baseline", gap: 8 }}>
          <h3>Trabajos a los que tienes acceso</h3>
          <span className="small muted">Cada oficio exige REA y sus certificados. Las promotoras pueden pedir además ISO.</span>
        </div>
        <div className="cells" style={{ gridTemplateColumns: "repeat(auto-fill,minmax(190px,1fr))" }}>
          {SECTOR_NAMES.map((sec) => {
            const req = reqFor(sec);
            const miss = req.filter((r) => !okIds.includes(r));
            const pendAll = miss.length > 0 && miss.every((r) => mine.some((c) => c.id === r && c.st === "pending"));
            const ok = !miss.length;
            return (
              <div key={sec} className="stack" style={{ padding: "12px 14px", gap: 4, background: ok ? "var(--color-accent-100)" : undefined }}>
                <div className="row between" style={{ gap: 6, flexWrap: "nowrap" }}>
                  <span style={{ font: "600 17px/1.1 var(--font-heading)" }}>{sec}</span>
                  <span className={ok ? "tag tag-accent" : "tag tag-neutral"}>{ok ? "Acceso" : pendAll ? "En revisión" : "Bloqueado"}</span>
                </div>
                <span className="xs" style={{ color: ok ? "var(--color-accent-800)" : "var(--color-neutral-700)" }}>
                  {ok ? "Con " + req.map((r) => CERTS[r].code).join(" + ") : "Necesitas " + miss.map((r) => CERTS[r].code).join(" + ")}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="stack" style={{ gap: 14 }}>
        <h3>Mis certificados</h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(min(100%,300px),1fr))", gap: 24 }}>
          {mine.map((c) => {
            const [stLabel, stCls] =
              c.st === "ok" && expired(c.exp) ? ["Caducado", "tag tag-outline"] : c.st === "ok" && expiresSoon(c.exp) ? ["Caduca pronto", "tag tag-outline"] : ST[c.st];
            return (
              <Blueprint key={c.id} className="stack" style={{ padding: 16, gap: 12 }}>
                <CertBadge cert={c} />
                <div className="row" style={{ gap: "6px 10px" }}>
                  <span className={stCls}>{stLabel}</span>
                  <span className="xs muted">{unlockTxt(c.id)}</span>
                </div>
                <label className="btn btn-ghost" style={{ alignSelf: "flex-start", cursor: "pointer" }}>
                  {c.logo ? "Cambiar logotipo" : "Subir logotipo"}
                  <input
                    type="file" accept="image/*" hidden
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) changeLogo(c.id, f); e.target.value = ""; }}
                  />
                </label>
              </Blueprint>
            );
          })}
        </div>
      </div>

      <Blueprint className="stack" style={{ padding: "clamp(18px,3vw,26px)", gap: 16, maxWidth: 880 }}>
        <h3>Añadir certificado</h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", gap: 14 }}>
          <Field label="Tipo de certificado">
            <select className="input" value={nc.id} onChange={(e) => { setNc({ ...nc, id: e.target.value as CertId }); setNcErr(""); }}>
              <option value="">Selecciona…</option>
              {options.map((id) => <option key={id} value={id}>{CERTS[id].code} · {CERTS[id].name}</option>)}
            </select>
          </Field>
          <Field label="Fecha de caducidad">
            <input className="input" type="month" value={nc.exp} onChange={(e) => { setNc({ ...nc, exp: e.target.value }); setNcErr(""); }} />
          </Field>
        </div>
        <div className="row" style={{ gap: 16 }}>
          <Blueprint className="stripes" style={{ width: 84, height: 84, flex: "none", display: "grid", placeItems: "center" }}>
            {nc.logo ? (
              <div style={{ width: 68, height: 68, background: `center / contain no-repeat url(${nc.logo})` }} />
            ) : (
              <span style={{ font: "500 10px ui-monospace,Menlo,monospace", color: "var(--color-neutral-700)", textAlign: "center" }}>
                {nc.id ? CERTS[nc.id].code : "LOGO"}
              </span>
            )}
          </Blueprint>
          <div className="stack" style={{ gap: 8 }}>
            <label className="btn btn-secondary" style={{ cursor: "pointer", alignSelf: "flex-start" }}>
              {nc.logo ? "Cambiar logotipo" : "Subir logotipo (PNG, SVG, JPG)"}
              <input
                type="file" accept="image/*" hidden
                onChange={async (e) => { const f = e.target.files?.[0]; if (f) { const logo = await readImage(f); setNc((n) => ({ ...n, logo, logoFile: f })); } e.target.value = ""; }}
              />
            </label>
            <button
              className="btn btn-secondary"
              style={{ alignSelf: "flex-start", color: nc.pdf ? "var(--color-accent-700)" : undefined }}
              onClick={() => pdfRef.current?.click()}
            >
              {nc.pdf ? nc.pdf.name + " ✓" : "Subir certificado (PDF)"}
            </button>
            <input
              ref={pdfRef} type="file" accept="application/pdf,.pdf" hidden
              onChange={(e) => { const f = e.target.files?.[0]; if (f) { setNc((n) => ({ ...n, pdf: f })); setNcErr(""); } e.target.value = ""; }}
            />
          </div>
          <span className="small muted" style={{ flex: "1 1 220px" }}>
            {nc.id ? unlockTxt(nc.id) + "." : "Elige un certificado para ver a qué trabajos da acceso."}
          </span>
        </div>
        {ncErr && <div className="err" role="alert">{ncErr}</div>}
        <PrimaryButton className="btn-md" style={{ alignSelf: "flex-start" }} onClick={submit} disabled={pending}>{pending ? "Enviando…" : "Enviar a verificación"}</PrimaryButton>
      </Blueprint>
    </div>
  );
}
