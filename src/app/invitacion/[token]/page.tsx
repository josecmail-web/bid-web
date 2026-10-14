import Link from "next/link";
import { eq } from "drizzle-orm";
import { findToken } from "@/server/security";
import { getDb, schema as s } from "@/server/db";
import { AuthFrame } from "@/components/AuthFrame";
import { AcceptForm } from "./AcceptForm";

export default async function InvitacionPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const t = await findToken("invite", token);
  let company: string | null = null;
  if (t?.companyId) {
    const db = await getDb();
    const [c] = await db.select({ name: s.companies.name }).from(s.companies).where(eq(s.companies.id, t.companyId));
    company = c?.name ?? null;
  }
  return (
    <AuthFrame>
      <div className="stack" style={{ gap: 16 }}>
        <div>
          <div className="kicker">Invitación</div>
          <h1 style={{ margin: "4px 0 6px", fontSize: 32 }}>{t && company ? `Únete a ${company}` : "La invitación no es válida"}</h1>
        </div>
        {t && company ? (
          <>
            <p className="muted" style={{ margin: 0 }}>Vas a entrar en Bidra como <b style={{ fontWeight: 500, color: "var(--color-text)" }}>{t.email}</b>. Elige tu contraseña.</p>
            <AcceptForm token={token} email={t.email} />
          </>
        ) : (
          <>
            <p className="muted" style={{ margin: 0 }}>Ha caducado (dura 7 días), ya se ha usado o la han cancelado. Pide a tu empresa que te invite de nuevo.</p>
            <Link href="/login" className="btn btn-secondary" style={{ alignSelf: "flex-start" }}>Ir al acceso</Link>
          </>
        )}
      </div>
    </AuthFrame>
  );
}
