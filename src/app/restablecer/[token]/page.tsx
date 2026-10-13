import Link from "next/link";
import { findToken } from "@/server/security";
import { AuthFrame } from "@/components/AuthFrame";
import { ResetForm } from "./ResetForm";

export default async function RestablecerPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const t = await findToken("reset", token);
  return (
    <AuthFrame>
      <div className="stack" style={{ gap: 16 }}>
        <div>
          <div className="kicker">Recuperar contraseña</div>
          <h1 style={{ margin: "4px 0 6px", fontSize: 32 }}>{t ? "Elige una contraseña nueva" : "El enlace no es válido"}</h1>
        </div>
        {t ? (
          <>
            <p className="muted" style={{ margin: 0 }}>Para {t.email}. Al guardarla se cerrarán todas tus sesiones abiertas.</p>
            <ResetForm token={token} email={t.email} />
          </>
        ) : (
          <>
            <p className="muted" style={{ margin: 0 }}>Ha caducado (dura 1 hora), ya se ha usado o se ha pedido uno más nuevo.</p>
            <Link href="/recuperar" className="btn btn-secondary" style={{ alignSelf: "flex-start" }}>Pedir otro enlace</Link>
          </>
        )}
      </div>
    </AuthFrame>
  );
}
