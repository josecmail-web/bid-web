"use client";

import { useState, useTransition } from "react";
import { useUI } from "@/lib/store";
import { ago, dateLabel } from "@/lib/format";
import { passwordError } from "@/lib/rules";
import { cancelInvite, changePassword, inviteMember, removeMember } from "@/server/actions/account";
import type { AccountDTO } from "@/lib/types";
import { Blueprint, Field, PrimaryButton } from "@/components/ui";

const VERIF: Record<"pending" | "approved" | "rejected", [string, string]> = {
  approved: ["Verificada por BID", "tag tag-accent"],
  pending: ["En revisión", "tag tag-outline"],
  rejected: ["No verificada", "tag tag-neutral"],
};

export function AccountView({ data }: { data: AccountDTO }) {
  const { flash } = useUI();
  const [pending, start] = useTransition();
  const c = data.company;

  /* — contraseña — */
  const [pw, setPw] = useState({ current: "", next: "", repeat: "" });
  const [pwErr, setPwErr] = useState("");
  const savePassword = (e: React.FormEvent) => {
    e.preventDefault();
    const bad = passwordError(pw.next, data.me.email);
    if (bad) return setPwErr(bad);
    if (pw.next !== pw.repeat) return setPwErr("Las contraseñas no coinciden.");
    start(async () => {
      const r = await changePassword(pw.current, pw.next);
      if (!r.ok) return setPwErr(r.error);
      setPw({ current: "", next: "", repeat: "" });
      flash("Contraseña cambiada. Hemos cerrado tus otras sesiones abiertas.");
    });
  };

  /* — equipo — */
  const [invite, setInvite] = useState("");
  const [invErr, setInvErr] = useState("");
  const [removing, setRemoving] = useState<{ id: string; email: string } | null>(null);
  const sendInvite = (e: React.FormEvent) => {
    e.preventDefault();
    start(async () => {
      const r = await inviteMember(invite);
      if (!r.ok) return setInvErr(r.error);
      setInvite("");
      flash(`Invitación enviada a ${r.email}.`);
    });
  };

  return (
    <div className="stack" style={{ gap: 30, maxWidth: 880 }}>
      <div>
        <div className="kicker">Tu cuenta</div>
        <h1 style={{ marginTop: 2 }}>{c ? c.name : "Equipo BID"}</h1>
        <div className="muted">{data.me.email}</div>
      </div>

      {c && (
        <div className="stack" style={{ gap: 12 }}>
          <div className="row between" style={{ alignItems: "baseline", gap: 8 }}>
            <h3>Empresa</h3>
            <span className={VERIF[c.verification][1]}>{VERIF[c.verification][0]}</span>
          </div>
          <div className="cells" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))" }}>
            {(
              [
                ["Tipo", c.type === "industrial" ? "Industrial" : "Promotora / constructora"],
                ["CIF / NIF", c.cif],
                ["Provincia", c.province],
                ["Email de contacto", c.email],
                ...(c.type === "industrial" ? [["Oficios", c.trades.join(", ") || "—"] as [string, string]] : []),
              ] as [string, string][]
            ).map(([k, v]) => (
              <div key={k} style={{ padding: "12px 14px" }}>
                <div className="label">{k}</div>
                <div style={{ fontWeight: 500, overflowWrap: "anywhere" }}>{v}</div>
              </div>
            ))}
          </div>
          <span className="xs muted">Para cambiar la razón social o el CIF escribe al equipo de BID: hay que volver a verificar la documentación.</span>
        </div>
      )}

      {c && (
        <div className="stack" style={{ gap: 12 }}>
          <div className="row between" style={{ alignItems: "baseline", gap: 8 }}>
            <h3>Equipo</h3>
            <span className="small muted">Todas las personas del equipo pueden publicar, pujar y gestionar la cuenta.</span>
          </div>
          <div className="scroll-x">
            <table className="table" style={{ minWidth: 560 }}>
              <thead>
                <tr><th>Persona</th><th>Último acceso</th><th>En BID desde</th><th /></tr>
              </thead>
              <tbody>
                {data.members.map((m) => (
                  <tr key={m.id}>
                    <td>{m.email}{m.isMe && <span className="tag tag-neutral" style={{ marginLeft: 8 }}>Tú</span>}</td>
                    <td className="muted">{m.lastLoginAt ? ago(m.lastLoginAt) : "Nunca"}</td>
                    <td className="muted">{dateLabel(m.createdAt)}</td>
                    <td className="r">
                      {!m.isMe && (
                        <button className="btn btn-ghost" disabled={pending} onClick={() => setRemoving({ id: m.id, email: m.email })}>Quitar</button>
                      )}
                    </td>
                  </tr>
                ))}
                {data.invites.map((i) => (
                  <tr key={i.id}>
                    <td>{i.email} <span className="tag tag-outline" style={{ marginLeft: 8 }}>Invitación pendiente</span></td>
                    <td className="muted xs" colSpan={2}>Caduca el {dateLabel(i.expiresAt)}{i.by ? ` · enviada por ${i.by}` : ""}</td>
                    <td className="r">
                      <button
                        className="btn btn-ghost"
                        disabled={pending}
                        onClick={() => start(async () => { const r = await cancelInvite(i.id); flash(r.ok ? `Invitación a ${i.email} cancelada.` : r.error); })}
                      >
                        Cancelar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <form className="row" style={{ gap: 8, alignItems: "flex-end" }} onSubmit={sendInvite}>
            <Field label="Invitar por email" style={{ flex: "1 1 260px" }}>
              <input className="input" type="email" required placeholder="compañero@empresa.es" value={invite} onChange={(e) => { setInvite(e.target.value); setInvErr(""); }} />
            </Field>
            <button className="btn btn-secondary" type="submit" style={{ minHeight: 36 }} disabled={pending}>Enviar invitación</button>
          </form>
          {invErr && <div className="err" role="alert">{invErr}</div>}
        </div>
      )}

      <Blueprint className="stack" style={{ padding: "clamp(18px,3vw,26px)", gap: 14, maxWidth: 520 }}>
        <h3>Cambiar contraseña</h3>
        <form className="stack" style={{ gap: 12 }} onSubmit={savePassword}>
          <input type="email" autoComplete="username" value={data.me.email} readOnly hidden />
          <Field label="Contraseña actual">
            <input className="input" type="password" autoComplete="current-password" value={pw.current} onChange={(e) => { setPw({ ...pw, current: e.target.value }); setPwErr(""); }} />
          </Field>
          <Field label="Contraseña nueva (mín. 8)">
            <input className="input" type="password" autoComplete="new-password" value={pw.next} onChange={(e) => { setPw({ ...pw, next: e.target.value }); setPwErr(""); }} />
          </Field>
          <Field label="Repite la contraseña nueva">
            <input className="input" type="password" autoComplete="new-password" value={pw.repeat} onChange={(e) => { setPw({ ...pw, repeat: e.target.value }); setPwErr(""); }} />
          </Field>
          {pwErr && <div className="err" role="alert">{pwErr}</div>}
          <PrimaryButton type="submit" className="btn-md" style={{ alignSelf: "flex-start" }} disabled={pending}>Guardar contraseña</PrimaryButton>
          <span className="xs muted">Al cambiarla se cierran tus sesiones abiertas en otros dispositivos.</span>
        </form>
      </Blueprint>

      {removing && (
        <div className="dialog-backdrop" onClick={() => !pending && setRemoving(null)}>
          <Blueprint className="dialog" role="dialog" aria-modal="true" onClick={(e: React.MouseEvent) => e.stopPropagation()}>
            <div className="dialog-title">¿Quitar a {removing.email}?</div>
            <div className="dialog-body">Perderá el acceso a {c?.name} en BID y se cerrarán sus sesiones. Lo que haya publicado o pujado se mantiene.</div>
            <div className="dialog-actions">
              <button className="btn btn-secondary" onClick={() => setRemoving(null)} disabled={pending}>Cancelar</button>
              <button
                className="btn btn-primary"
                disabled={pending}
                onClick={() => start(async () => { const r = await removeMember(removing.id); setRemoving(null); flash(r.ok ? `${r.email} ya no tiene acceso.` : r.error); })}
              >
                Quitar del equipo
              </button>
            </div>
          </Blueprint>
        </div>
      )}
    </div>
  );
}
