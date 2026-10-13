"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Bell } from "lucide-react";
import { ago } from "@/lib/format";
import { fetchNotifications, markAllNotificationsRead, markNotificationRead } from "@/server/actions/notifications";
import type { NotificationDTO, NotificationsDTO } from "@/lib/types";
import { Corners } from "./ui";

const KIND: Record<string, string> = {
  tender_published: "Paquete nuevo",
  tender_closed: "Puja cerrada",
  tender_awarded: "Adjudicación",
  tender_not_awarded: "No adjudicada",
  review_received: "Valoración",
  report_resolved: "Reporte",
  cert_approved: "Certificado",
  cert_rejected: "Certificado",
  company_approved: "Verificación",
  company_rejected: "Verificación",
  docs_requested: "Documentación",
};

const POLL_MS = 60_000;

export function NotificationBell({ initial }: { initial: NotificationsDTO }) {
  const router = useRouter();
  const path = usePathname();
  const [data, setData] = useState(initial);
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);

  const reload = useCallback(async () => {
    const r = await fetchNotifications();
    if (r.ok) setData(r.data);
  }, []);

  // Al navegar y cada minuto (solo con la pestaña visible)
  useEffect(() => {
    reload();
  }, [path, reload]);
  useEffect(() => {
    const t = setInterval(() => document.visibilityState === "visible" && reload(), POLL_MS);
    return () => clearInterval(t);
  }, [reload]);

  // Cerrar al hacer clic fuera o con Escape
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => wrap.current && !wrap.current.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const toggle = () => {
    setOpen((o) => !o);
    if (!open) reload();
  };

  const go = (n: NotificationDTO) => {
    if (!n.read) {
      setData((d) => ({ unread: Math.max(0, d.unread - 1), items: d.items.map((x) => (x.id === n.id ? { ...x, read: true } : x)) }));
      markNotificationRead(n.id);
    }
    setOpen(false);
    if (n.link) router.push(n.link);
  };

  const readAll = () => {
    setData((d) => ({ unread: 0, items: d.items.map((x) => ({ ...x, read: true })) }));
    markAllNotificationsRead();
  };

  const label = data.unread ? `Avisos: ${data.unread} sin leer` : "Avisos";

  return (
    <div className="bell-wrap" ref={wrap}>
      <button type="button" className="btn btn-icon btn-ghost bell-btn" aria-label={label} aria-expanded={open} aria-haspopup="dialog" onClick={toggle}>
        <Bell size={19} strokeWidth={1.5} />
        {data.unread > 0 && <span className="bell-badge" aria-hidden>{data.unread > 9 ? "9+" : data.unread}</span>}
      </button>
      {open && (
        <div className="bell-panel blueprint" role="dialog" aria-label="Avisos">
          <Corners />
          <div className="row between" style={{ gap: 8, padding: "12px 14px", borderBottom: "1px solid var(--color-divider)" }}>
            <span className="figure" style={{ fontSize: 18 }}>Avisos</span>
            {data.unread > 0 && (
              <button type="button" className="btn btn-ghost" onClick={readAll}>Marcar todo como leído</button>
            )}
          </div>
          {data.items.length === 0 ? (
            <p className="small muted" style={{ margin: 0, padding: "18px 14px" }}>No tienes avisos todavía.</p>
          ) : (
            <ul className="bell-list">
              {data.items.map((n) => (
                <li key={n.id}>
                  <button type="button" className="bell-item" data-unread={!n.read} onClick={() => go(n)}>
                    <span className="bell-dot" aria-hidden />
                    <span className="stack" style={{ gap: 2, minWidth: 0 }}>
                      <span className="row between" style={{ gap: 8, flexWrap: "nowrap" }}>
                        <span className="label" style={{ color: n.read ? undefined : "var(--color-accent-700)" }}>{KIND[n.kind] ?? "Aviso"}</span>
                        <span className="xs muted" style={{ whiteSpace: "nowrap" }}>{ago(n.createdAt)}</span>
                      </span>
                      <span style={{ fontSize: 14, lineHeight: 1.4 }}>{n.message}</span>
                      {!n.read && <span className="sr-only">(sin leer)</span>}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
