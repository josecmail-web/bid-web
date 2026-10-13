import { AuthError } from "./auth";
import { UploadError } from "./storage";
import type { ActionResult } from "@/lib/types";

/** Error de validación con mensaje apto para mostrar al usuario. */
export class UserError extends Error {}

/** Ejecuta una acción y convierte los errores esperables en { ok: false, error }. */
export async function safe<T extends object>(fn: () => Promise<ActionResult<T>>): Promise<ActionResult<T>> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof AuthError || e instanceof UploadError || e instanceof UserError) return { ok: false, error: e.message };
    console.error(e);
    return { ok: false, error: "Ha ocurrido un error. Inténtalo de nuevo." };
  }
}

export const str = (v: FormDataEntryValue | null) => (typeof v === "string" ? v.trim() : "");
