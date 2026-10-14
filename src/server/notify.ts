import { inArray } from "drizzle-orm";
import type { DB } from "./db";
import { schema as s } from "./db";
import { appUrl, sendEmail } from "./mail";

/** Asunto y botón del email según el tipo de aviso. */
const EMAIL: Record<string, { subject: string; action: string }> = {
  tender_published: { subject: "Nuevo paquete de tu oficio en Bidra", action: "Ver el paquete" },
  tender_closed: { subject: "Tu puja ha cerrado: ya puedes comparar ofertas", action: "Comparar ofertas" },
  tender_awarded: { subject: "Te han adjudicado un paquete en Bidra", action: "Ver el paquete" },
  tender_not_awarded: { subject: "Resultado de tu puja en Bidra", action: "Ver el paquete" },
  review_received: { subject: "Has recibido una valoración en Bidra", action: "Ver mis valoraciones" },
  report_resolved: { subject: "Hemos revisado tu reporte", action: "Ver mis valoraciones" },
  cert_approved: { subject: "Certificado validado en Bidra", action: "Ver mis certificados" },
  cert_rejected: { subject: "Certificado rechazado en Bidra", action: "Ver mis certificados" },
  company_approved: { subject: "Tu empresa está verificada en Bidra", action: "Entrar en Bidra" },
  company_rejected: { subject: "No hemos podido verificar tu empresa", action: "Entrar en Bidra" },
  docs_requested: { subject: "Necesitamos documentación para verificar tu empresa", action: "Entrar en Bidra" },
};

/** Aviso in-app (campana) + email a la dirección de contacto de cada empresa. */
export async function notify(db: DB, companyIds: string[], kind: string, message: string, link?: string) {
  if (!companyIds.length) return;
  await db.insert(s.notifications).values(companyIds.map((companyId) => ({ companyId, kind, message, link })));
  const to = await db.select({ email: s.companies.email }).from(s.companies).where(inArray(s.companies.id, companyIds));
  const meta = EMAIL[kind] ?? { subject: "Aviso de Bidra", action: "Abrir Bidra" };
  await sendEmail({
    to: to.map((t) => t.email),
    subject: meta.subject,
    text: message,
    action: { label: meta.action, url: await appUrl(link ?? "/") },
  });
}
