import Link from "next/link";
import { AuthFrame } from "@/components/AuthFrame";

export default function NotFound() {
  return (
    <AuthFrame>
      <div className="stack" style={{ gap: 14 }}>
        <h2 style={{ fontSize: 28, margin: 0 }}>No encontramos esta página</h2>
        <p className="muted" style={{ margin: 0 }}>Puede que el enlace sea antiguo o esté mal escrito.</p>
        <Link href="/" className="btn btn-primary" style={{ alignSelf: "flex-start" }}>Ir al inicio</Link>
      </div>
    </AuthFrame>
  );
}
