/**
 * Identificación fiscal española con dígito de control:
 * - CIF (sociedades): letra + 7 dígitos + control (dígito o letra según el tipo de entidad).
 * - NIF (autónomos): 8 dígitos + letra.
 * - NIE (autónomos extranjeros): X/Y/Z + 7 dígitos + letra.
 */

export type TaxIdKind = "CIF" | "NIF" | "NIE";
export type TaxIdResult = { ok: true; kind: TaxIdKind; value: string } | { ok: false; error: string };

const NIF_LETTERS = "TRWAGMYFPDXBNJZSQVHLCKE";
const CIF_CONTROL_LETTERS = "JABCDEFGHI";

/** Dígito de control (0-9) de un CIF a partir de sus 7 dígitos centrales. */
export function cifControlDigit(digits7: string) {
  let sum = 0;
  for (let i = 0; i < 7; i++) {
    const n = Number(digits7[i]);
    if (i % 2 === 1) sum += n;
    else {
      const d = n * 2;
      sum += Math.floor(d / 10) + (d % 10);
    }
  }
  return (10 - (sum % 10)) % 10;
}

/** Completa un CIF ("B4612345") con su carácter de control correcto. */
export function withCifControl(prefix8: string) {
  const letter = prefix8[0].toUpperCase();
  const digit = cifControlDigit(prefix8.slice(1, 8));
  const useLetter = "KPQRSNW".includes(letter);
  return prefix8.slice(0, 8).toUpperCase() + (useLetter ? CIF_CONTROL_LETTERS[digit] : String(digit));
}

export function validateTaxId(raw: string): TaxIdResult {
  const v = raw.toUpperCase().replace(/[\s.\-]/g, "");
  if (!v) return { ok: false, error: "Indica el CIF o NIF de la empresa." };

  // NIF
  if (/^\d{8}[A-Z]$/.test(v)) {
    return NIF_LETTERS[Number(v.slice(0, 8)) % 23] === v[8]
      ? { ok: true, kind: "NIF", value: v }
      : { ok: false, error: "La letra del NIF no es correcta." };
  }
  // NIE
  if (/^[XYZ]\d{7}[A-Z]$/.test(v)) {
    const num = Number("XYZ".indexOf(v[0]) + v.slice(1, 8));
    return NIF_LETTERS[num % 23] === v[8] ? { ok: true, kind: "NIE", value: v } : { ok: false, error: "La letra del NIE no es correcta." };
  }
  // CIF
  if (/^[ABCDEFGHJNPQRSUVW]\d{7}[0-9A-J]$/.test(v)) {
    const digit = cifControlDigit(v.slice(1, 8));
    const control = v[8];
    const letter = v[0];
    const okDigit = control === String(digit);
    const okLetter = control === CIF_CONTROL_LETTERS[digit];
    // A, B, E, H → siempre dígito; K, P, Q, R, S, N, W → siempre letra; el resto admite ambos
    const valid = "ABEH".includes(letter) ? okDigit : "KPQRSNW".includes(letter) ? okLetter : okDigit || okLetter;
    return valid ? { ok: true, kind: "CIF", value: v } : { ok: false, error: "El dígito de control del CIF no es correcto. Revísalo." };
  }
  return { ok: false, error: "El CIF o NIF no tiene un formato válido (p. ej. B12345674 o 12345678Z)." };
}
