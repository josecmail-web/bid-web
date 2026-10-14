"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { useUI } from "@/lib/store";
import { avg, stars } from "@/lib/format";
import { fetchIndustrialProfile } from "@/server/actions/promotora";
import type { IndustrialProfileDTO } from "@/lib/types";
import { Blueprint, CatBars, CertBadge } from "./ui";

/** Perfil público del industrial: panel lateral derecho. */
export function ProfileDrawer() {
  const { profileId, openProfile } = useUI();
  const [P, setP] = useState<IndustrialProfileDTO | null>(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (!profileId) return;
    let live = true;
    setP(null);
    setErr("");
    fetchIndustrialProfile(profileId).then((r) => {
      if (!live) return;
      if (r.ok) setP(r.profile);
      else setErr(r.error);
    });
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && openProfile(null);
    window.addEventListener("keydown", onKey);
    return () => {
      live = false;
      window.removeEventListener("keydown", onKey);
    };
  }, [profileId, openProfile]);

  if (!profileId) return null;
  const rating = P?.r ? avg(P.r) : 0;

  return (
    <div className="drawer-backdrop" onClick={() => openProfile(null)}>
      <aside className="drawer" role="dialog" aria-modal="true" aria-label={P ? "Perfil de " + P.name : "Perfil industrial"} aria-busy={!P} onClick={(e) => e.stopPropagation()}>
        <div className="row between">
          <span className="kicker">Perfil industrial</span>
          <button className="btn btn-icon btn-secondary" onClick={() => openProfile(null)} aria-label="Cerrar" autoFocus>
            <X size={18} strokeWidth={1.5} />
          </button>
        </div>
        {!P ? (
          <p className="muted">{err || "Cargando…"}</p>
        ) : (
          <>
            <div>
              <h2>{P.name}</h2>
              <div className="muted" style={{ fontSize: 14 }}>
                {P.city}
                {P.since ? " · en activo desde " + P.since : ""}
              </div>
              <div className="row" style={{ gap: 6, marginTop: 8 }}>
                <span className="tag tag-accent">Verificada por Bidra</span>
              </div>
            </div>

            {P.certs.length > 0 && (
              <div className="stack" style={{ gap: 12 }}>
                <h4>Certificados validados</h4>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(190px,1fr))", gap: "18px 16px" }}>
                  {P.certs.map((c) => <CertBadge key={c.id} cert={c} />)}
                </div>
              </div>
            )}

            {P.r ? (
              <>
                <Blueprint className="stack" style={{ padding: 16, gap: 12 }}>
                  <div className="row" style={{ alignItems: "baseline", gap: 12 }}>
                    <span className="figure" style={{ fontSize: 48, lineHeight: 1 }}>{rating.toFixed(1)}</span>
                    <div>
                      <div className="stars" style={{ fontSize: 18 }}>{stars(rating)}</div>
                      <div className="xs muted">Media de {P.jobs} obras valoradas</div>
                    </div>
                  </div>
                  <CatBars r={P.r} labelWidth={72} lg />
                </Blueprint>
                {P.reviews.length > 0 && (
                  <div className="stack" style={{ gap: 14 }}>
                    <h4>Valoraciones de promotoras</h4>
                    {P.reviews.map((r, i) => {
                      const a = avg(r.r);
                      return (
                        <div key={i} className="stack" style={{ gap: 4, paddingBottom: 14, borderBottom: "1px solid var(--color-divider)" }}>
                          <div className="row between xs muted" style={{ gap: 8 }}>
                            <span>{r.by} · {r.obra}</span>
                            <span>{r.date}</span>
                          </div>
                          <div className="stars">
                            {stars(a)} <span style={{ color: "var(--color-text)", fontSize: 13 }}>{a.toFixed(1)}</span>
                          </div>
                          <div style={{ fontSize: 14 }}>{r.text}</div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            ) : (
              <p className="muted">Empresa nueva en Bidra: aún no tiene obras valoradas.</p>
            )}
          </>
        )}
      </aside>
    </div>
  );
}
