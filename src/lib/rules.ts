/* Reglas de negocio compartidas: el cliente las usa para avisar antes, el servidor las vuelve a aplicar. */

import { SECTOR_NAMES } from "./catalog";
import type { WizardState } from "./types";

/** Contraseñas demasiado comunes (lista corta; en producción, comprobar contra filtraciones conocidas). */
const COMMON = new Set([
  "12345678", "123456789", "1234567890", "password", "password1", "contraseña", "contrasena", "qwertyui", "qwerty123",
  "11111111", "00000000", "iloveyou", "abcd1234", "admin123", "bid12345", "obras123", "valencia", "madrid123",
]);

/** Problema de una contraseña nueva ("" si es válida). */
export function passwordError(pw: string, email = "") {
  if (pw.length < 8) return "La contraseña debe tener al menos 8 caracteres.";
  if (pw.length > 200) return "La contraseña es demasiado larga.";
  if (COMMON.has(pw.toLowerCase())) return "Esa contraseña es demasiado común. Elige otra.";
  if (email && pw.toLowerCase() === email.toLowerCase()) return "La contraseña no puede ser tu email.";
  if (/^(.)\1+$/.test(pw)) return "La contraseña no puede ser un mismo carácter repetido.";
  return "";
}
export const EMAIL_RE = /^\S+@\S+\.\S+$/;

/** Documentos de alta. Cada entrada: [clave, descripción, tipos de documento que la satisfacen]. */
export function requiredDocs(type: "promotora" | "industrial"): [string, string, string[]][] {
  return type === "industrial"
    ? [
        ["CIF", "Tarjeta de identificación fiscal", ["CIF"]],
        ["REA", "Inscripción en el Registro de Empresas Acreditadas", ["REA"]],
        ["Seguro RC", "Póliza de responsabilidad civil vigente", ["Seguro RC"]],
      ]
    : [
        ["CIF", "Tarjeta de identificación fiscal", ["CIF"]],
        ["Escrituras", "Escritura de constitución o poder del representante", ["Escrituras", "Poder notarial"]],
      ];
}

/** Validación por paso del asistente de publicación ("" = correcto). */
export function validateWizardStep(w: WizardState, step: number): string {
  const inc = w.partidas.filter((p) => p.on);
  if (step === 0 && (!w.obra.trim() || !w.loc.trim())) return "Indica la obra y su ubicación.";
  if (step === 1) {
    if (!inc.length) return "Sube un Excel o añade al menos una partida.";
    const unc = inc.filter((p) => !p.sector).length;
    if (unc) return "Asigna un sector a " + (unc === 1 ? "la partida sin clasificar" : "las " + unc + " partidas sin clasificar") + " o exclúyelas.";
    const noQty = inc.filter((p) => !(p.q > 0));
    if (noQty.length) {
      const codes = noQty.slice(0, 4).map((p) => p.code).join(", ") + (noQty.length > 4 ? "…" : "");
      return (noQty.length === 1 ? `Falta la medición de la partida ${codes}.` : `Faltan las mediciones de ${noQty.length} partidas (${codes}).`) + " Escríbelas en la lista o exclúyelas.";
    }
    if (inc.some((p) => p.sector && !SECTOR_NAMES.includes(p.sector))) return "Hay partidas con un sector no válido.";
  }
  if (step === 2) {
    if (!w.close) return "Indica la fecha de cierre de la puja.";
    const t = new Date(w.close).getTime();
    if (!Number.isFinite(t) || t <= Date.now() + 3600e3) return "El cierre de la puja debe ser al menos dentro de una hora.";
  }
  return "";
}

/** Horas que tienen los titulares del tanteo para igualar la mejor oferta tras el cierre. */
export const TANTEO_HOURS = 72;
/** Máximo de titulares por publicación. */
export const TANTEO_MAX = 5;

export const MIN_RATING: Record<WizardState["min"], number | null> = { Cualquiera: null, "3+": 3, "4+": 4, "4,5+": 4.5 };

export const emptyWizard = (): WizardState => ({
  step: 0, draftId: null, obra: "", loc: "", start: "", desc: "", files: [], partidas: [], fileName: "", importNote: "",
  close: "", scope: "abierta", min: "Cualquiera", refs: {}, extra: [], tanteo: [],
});
