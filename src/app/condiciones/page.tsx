import type { Metadata } from "next";
import Link from "next/link";
import { PILOT, TARIFF_TEXT, TERMS_VERSION, feeFor } from "@/lib/pricing";
import { eur } from "@/lib/format";

export const metadata: Metadata = { title: "Condiciones de uso · BID" };

/**
 * BORRADOR: texto de trabajo para el piloto. Debe revisarlo un abogado antes de usarse con clientes
 * (contratación electrónica, LSSI, RGPD, condiciones generales de la contratación).
 */
export default function CondicionesPage() {
  return (
    <main className="app-main" style={{ maxWidth: 780 }}>
      <div className="stack" style={{ gap: 18 }}>
        <Link href="/login" className="btn btn-ghost" style={{ alignSelf: "flex-start" }}>← BID</Link>
        <div>
          <div className="kicker">Versión {TERMS_VERSION}</div>
          <h1 style={{ marginTop: 2 }}>Condiciones de uso</h1>
        </div>
        <div className="small" style={{ padding: "10px 14px", border: "1px dashed var(--color-divider)" }}>
          Borrador para el piloto, pendiente de revisión legal.
        </div>

        <Section n="1" title="Qué es BID">
          BID es una plataforma en la que promotoras y constructoras publican partidas de obra agrupadas en paquetes, e industriales
          verificados presentan su presupuesto en puja ciega. La promotora adjudica libremente a la oferta que prefiera, por precio,
          valoración u otros criterios. BID no es parte del contrato de obra entre la promotora y el industrial.
        </Section>

        <Section n="2" title="Registro y verificación">
          Cada empresa aporta datos y documentación veraces (CIF/NIF, REA, seguro de responsabilidad civil, escrituras o poderes).
          BID revisa la documentación antes de permitir publicar o pujar y puede solicitar más documentos, rechazar o suspender cuentas.
          Los certificados que dan acceso a cada oficio deben estar vigentes; al caducar, se pierde el acceso.
        </Section>

        <Section n="3" title="Puja ciega">
          Mientras un paquete está abierto, nadie, tampoco la promotora, ve los importes ni la identidad de los pujadores; la promotora
          solo ve el número de sobres. Cada industrial ve únicamente su propia oferta, que puede modificar hasta el cierre. BID no vende
          posición, visibilidad ni información sobre las ofertas de otros.
        </Section>

        <Section n="4" title="Comisión por adjudicación">
          <p style={{ margin: "0 0 10px" }}>
            Pujar es gratuito. Cuando una promotora adjudica un paquete a través de BID, el industrial adjudicatario abona a BID una
            comisión del <b style={{ fontWeight: 500 }}>{TARIFF_TEXT}</b>, más los impuestos aplicables. Por ejemplo, un paquete adjudicado por
            100.000 € genera una comisión de {eur(feeFor(100000))}.
          </p>
          {PILOT && (
            <p style={{ margin: 0 }}>
              <b style={{ fontWeight: 500 }}>Durante el piloto la comisión no se cobra.</b> BID registra el importe que habría correspondido con fines
              informativos y avisará con al menos 30 días de antelación antes de empezar a cobrarla. Las adjudicaciones del piloto no
              generarán comisión en ningún caso.
            </p>
          )}
        </Section>

        <Section n="5" title="No elusión">
          Si una promotora y un industrial que ha pujado en un paquete publicado en BID contratan esos trabajos, o trabajos
          sustancialmente iguales de la misma obra, la adjudicación debe registrarse en BID, aunque se negocie o formalice fuera de la
          plataforma. Esta obligación se mantiene durante los 12 meses siguientes al cierre de la puja.
        </Section>

        <Section n="6" title="Valoraciones">
          Tras una adjudicación, la promotora puede valorar al industrial en calidad, plazos, limpieza y trato. Las valoraciones deben
          ser honestas y referirse a la obra realizada. El industrial puede reportar una valoración; BID la revisa y decide si se mantiene
          o se oculta.
        </Section>

        <Section n="7" title="Datos y confidencialidad">
          Las ofertas son confidenciales y solo las ve la promotora tras el cierre. BID puede usar datos agregados y anónimos (por ejemplo,
          precios medios por tipo de partida) sin identificar a ninguna empresa ni oferta concreta. El tratamiento de datos personales se
          rige por la política de privacidad.
        </Section>

        <Section n="8" title="Responsabilidad">
          Cada empresa es responsable de la veracidad de su información, de sus ofertas y de la ejecución de los trabajos. BID verifica
          documentación pero no garantiza la ejecución de las obras ni la solvencia de las partes.
        </Section>
      </div>
    </main>
  );
}

function Section({ n, title, children }: { n: string; title: string; children: React.ReactNode }) {
  return (
    <section className="stack" style={{ gap: 6 }}>
      <h3>
        <span className="mono" style={{ marginRight: 10 }}>{n.padStart(2, "0")}</span>
        {title}
      </h3>
      <div className="muted" style={{ fontSize: 15 }}>{children}</div>
    </section>
  );
}
