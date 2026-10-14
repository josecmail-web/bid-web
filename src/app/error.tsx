"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { isStaleDeploy, reloadForNewVersion } from "@/lib/stale";

/** Errores en el navegador. Si es una página de una versión anterior, recarga sola. */
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const [reloading, setReloading] = useState(false);
  useEffect(() => {
    if (isStaleDeploy(error) && reloadForNewVersion()) setReloading(true);
    else console.error(error);
  }, [error]);

  return (
    <main className="app-main" style={{ maxWidth: 560 }}>
      <div className="stack" style={{ gap: 14, paddingTop: 40 }}>
        <h1>{reloading ? "Hay una versión nueva de Bidra" : "Algo ha fallado"}</h1>
        <p className="muted" style={{ margin: 0 }}>
          {reloading
            ? "Estamos recargando la página. Si no se recarga sola en unos segundos, pulsa «Recargar»."
            : "No hemos podido completar la acción. Vuelve a intentarlo; si sigue pasando, recarga la página."}
        </p>
        <div className="row" style={{ gap: 8 }}>
          <button className="btn btn-primary" onClick={() => (reloading ? window.location.reload() : reset())}>
            {reloading ? "Recargar" : "Reintentar"}
          </button>
          <Link href="/" className="btn btn-secondary">Ir al inicio</Link>
        </div>
      </div>
    </main>
  );
}
