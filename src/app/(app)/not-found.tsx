import Link from "next/link";

/** Paquete o página inexistente, o sin acceso (p. ej. un paquete de otro sector o ya cerrado). */
export default function NotFound() {
  return (
    <div className="stack" style={{ gap: 14, maxWidth: 560, paddingTop: 24 }}>
      <div className="kicker">No disponible</div>
      <h1>No encontramos esta página</h1>
      <p className="muted" style={{ margin: 0 }}>
        Puede que el enlace sea antiguo o que no tengas acceso: los paquetes solo los ven los industriales del sector que cumplen sus
        requisitos mientras la puja está abierta, y quienes pujaron en ellos.
      </p>
      <Link href="/" className="btn btn-primary" style={{ alignSelf: "flex-start" }}>Ir al inicio</Link>
    </div>
  );
}
