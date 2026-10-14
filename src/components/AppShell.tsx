"use client";

import { useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useUI } from "@/lib/store";
import { homeFor } from "@/lib/routes";
import { demoLogin, logout } from "@/server/actions/auth";
import type { NotificationsDTO, Role, ShellUser } from "@/lib/types";
import { Seg, Toast } from "./ui";
import { ProfileDrawer } from "./ProfileDrawer";
import { NotificationBell } from "./NotificationBell";

const NAV: Record<Role, [string, string, string][]> = {
  // [href, etiqueta, prefijo activo]
  promotora: [["/partidas", "Partidas", "/partidas"], ["/partidas/nueva", "Publicar", "/partidas/nueva"]],
  industrial: [
    ["/industrial/paquetes", "Paquetes", "/industrial/paquetes"],
    ["/industrial/pujas", "Mis pujas", "/industrial/pujas"],
    ["/industrial/perfil", "Mi perfil y certificados", "/industrial/perfil"],
  ],
  admin: [["/admin/verificaciones", "Panel", "/admin"]],
};

export function AppShell({ user, notifications, children }: { user: ShellUser; notifications: NotificationsDTO | null; children: React.ReactNode }) {
  const { toast, flash, openProfile } = useUI();
  const router = useRouter();
  const path = usePathname();
  const [pending, start] = useTransition();
  const nav = NAV[user.role];
  // "Publicar" activo solo en /partidas/nueva; "Partidas" en el resto de /partidas
  const active = nav.filter(([, , p]) => path.startsWith(p)).sort((a, b) => b[2].length - a[2].length)[0]?.[0];

  return (
    <>
      <header className="app-header">
        <Link href={homeFor(user.role)} aria-label="Inicio">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/bidra-logo.png" alt="Bidra Pro" className="app-logo" />
        </Link>
        <nav className="row" style={{ gap: 2 }}>
          {nav.map(([href, label]) => (
            <Link key={href} href={href} className="tabbtn" aria-current={href === active ? "page" : undefined}>
              {label}
            </Link>
          ))}
        </nav>
        <div className="row" style={{ marginLeft: "auto", gap: 12 }}>
          {user.demo && (
            <Seg
              size="xs"
              ariaLabel="Rol (demo)"
              options={["promotora", "industrial", "admin"] as const}
              labels={["Promotora", "Industrial", "Admin"]}
              value={user.role}
              onChange={(r) =>
                start(async () => {
                  const res = await demoLogin(r);
                  if (!res.ok) return flash(res.error);
                  openProfile(null);
                  router.push(res.home);
                })
              }
            />
          )}
          {/* key: al cambiar de usuario (demo) la campana arranca con sus avisos */}
          {notifications && <NotificationBell key={user.email} initial={notifications} />}
          <Link href="/cuenta" className="account-link" title="Tu cuenta y equipo" aria-current={path === "/cuenta" ? "page" : undefined}>
            {user.companyName}
          </Link>
          <button
            className="btn btn-ghost"
            disabled={pending}
            onClick={() =>
              start(async () => {
                await logout();
                openProfile(null);
                router.replace("/login");
                router.refresh();
              })
            }
          >
            Salir
          </button>
        </div>
      </header>
      {user.verification && user.verification !== "approved" && (
        <div style={{ background: "var(--color-accent-100)", color: "var(--color-accent-800)", borderBottom: "1px solid var(--color-divider)", padding: "10px clamp(16px,3vw,32px)", fontSize: 14 }}>
          {user.verification === "pending"
            ? `${user.companyName} está en revisión. Validamos CIF y documentación en 24–48 h laborables; hasta entonces no podrás ${user.role === "industrial" ? "pujar" : "publicar partidas"}.`
            : "No hemos podido verificar tu empresa. Contacta con el equipo de Bidra."}
        </div>
      )}
      <main className="app-main" aria-busy={pending}>{children}</main>
      <ProfileDrawer />
      <Toast msg={toast} />
    </>
  );
}
