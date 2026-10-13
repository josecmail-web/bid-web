import { headers } from "next/headers";

/**
 * Envío de emails con Resend (https://resend.com), por su API HTTP.
 *
 *   RESEND_API_KEY     clave de la API. Si falta, los emails se escriben en la consola del servidor.
 *   EMAIL_FROM         remitente, p. ej. "BID <avisos@tudominio.es>" (dominio verificado en Resend).
 *                      Sin dominio verificado: "BID <onboarding@resend.dev>" (solo entrega a tu propio email).
 *   EMAIL_REDIRECT_TO  (desarrollo/demo) desvía TODOS los emails a esta dirección. Con BID_DEMO=1 es
 *                      obligatorio para enviar de verdad: los datos de ejemplo tienen emails inventados.
 *
 * Un email por destinatario (nadie ve las direcciones de los demás). Los fallos se registran pero no
 * interrumpen la acción que los provoca.
 */

export interface Email {
  to: string | string[];
  subject: string;
  /** texto plano; los párrafos se separan con una línea en blanco */
  text: string;
  /** botón principal del email */
  action?: { label: string; url: string };
}

const API = () => (process.env.RESEND_API_URL || "https://api.resend.com").replace(/\/$/, "");
const DEMO_DOMAIN = /@[^@]*\.bid-demo\.es$/i;

export async function sendEmail(email: Email) {
  const to = [...new Set((Array.isArray(email.to) ? email.to : [email.to]).map((t) => t.trim().toLowerCase()).filter(Boolean))];
  if (!to.length) return;
  const key = process.env.RESEND_API_KEY;
  const redirect = process.env.EMAIL_REDIRECT_TO?.trim();

  const messages = to
    // Nunca enviar de verdad a las empresas inventadas de la demo
    .filter((addr) => !(key && !redirect && DEMO_DOMAIN.test(addr)))
    .map((addr) => ({
      from: process.env.EMAIL_FROM || "BID <onboarding@resend.dev>",
      to: [redirect || addr],
      subject: redirect ? `[para ${addr}] ${email.subject}` : email.subject,
      text: plain(email),
      html: html(email),
      ...(process.env.EMAIL_REPLY_TO ? { reply_to: process.env.EMAIL_REPLY_TO } : {}),
    }));

  // En modo demo los datos son inventados (y algún dominio podría existir): solo se envía de verdad
  // si todo va desviado a EMAIL_REDIRECT_TO.
  if (key && process.env.BID_DEMO === "1" && !redirect) {
    console.warn("[email] Modo demo sin EMAIL_REDIRECT_TO: no se envía nada de verdad, se muestra en consola.");
  }
  if (!key || (process.env.BID_DEMO === "1" && !redirect)) {
    for (const m of messages) console.info(`\n[email · consola] → ${m.to[0]}\n  Asunto: ${m.subject}\n  ${m.text.replace(/\n/g, "\n  ")}\n`);
    return;
  }

  // Lotes de hasta 100 (límite de /emails/batch)
  for (let i = 0; i < messages.length; i += 100) {
    const chunk = messages.slice(i, i + 100);
    try {
      const res = await fetch(chunk.length === 1 ? `${API()}/emails` : `${API()}/emails/batch`, {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify(chunk.length === 1 ? chunk[0] : chunk),
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) console.error(`[email] Resend ${res.status}: ${(await res.text()).slice(0, 300)} (asunto: ${email.subject})`);
    } catch (e) {
      console.error(`[email] No se pudo contactar con Resend: ${(e as Error).message} (asunto: ${email.subject})`);
    }
  }
}

/* — plantillas — */

function plain(e: Email) {
  return e.text + (e.action ? `\n\n${e.action.label}: ${e.action.url}` : "") + "\n\n—\nBID · Build Invest Direct";
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** HTML sencillo con la estética de BID (Industry): fondo claro, acento acero, sin esquinas redondeadas. */
function html(e: Email) {
  const paras = e.text
    .split(/\n\s*\n/)
    .map((p) => `<p style="margin:0 0 14px;font-size:15px;line-height:1.55;color:#1d1f20">${esc(p).replace(/\n/g, "<br>")}</p>`)
    .join("");
  const button = e.action
    ? `<p style="margin:22px 0 8px"><a href="${esc(e.action.url)}" style="display:inline-block;background:#5980a6;color:#f2f2f3;text-decoration:none;font-weight:600;font-size:15px;padding:11px 20px;border:1px solid #5980a6">${esc(e.action.label)}</a></p>
       <p style="margin:0 0 14px;font-size:12px;color:#5d5d60">Si el botón no funciona, copia este enlace: <a href="${esc(e.action.url)}" style="color:#416180">${esc(e.action.url)}</a></p>`
    : "";
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(e.subject)}</title></head>
<body style="margin:0;padding:0;background:#f2f2f3;font-family:Arial,Helvetica,sans-serif">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f2f2f3"><tr><td align="center" style="padding:28px 16px">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;border:1px solid #d4d4d7;background:#f2f2f3">
      <tr><td style="padding:18px 24px;border-bottom:1px solid #d4d4d7;font-weight:700;font-size:20px;letter-spacing:.12em;color:#1d1f20">BID</td></tr>
      <tr><td style="padding:24px">${paras}${button}</td></tr>
      <tr><td style="padding:14px 24px;border-top:1px solid #d4d4d7;font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:#7a7a7d">Build · Invest · Direct</td></tr>
    </table>
  </td></tr></table>
</body></html>`;
}

/** URL absoluta para los enlaces de los emails: APP_URL o, si no está, el host de la petición. */
export async function appUrl(path: string) {
  let base = process.env.APP_URL;
  if (!base) {
    try {
      const h = await headers();
      base = `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host") ?? "localhost:3000"}`;
    } catch {
      base = "http://localhost:3000";
    }
  }
  return base.replace(/\/$/, "") + path;
}
