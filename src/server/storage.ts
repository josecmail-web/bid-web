import { mkdir, readFile, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { dataDir } from "./db";
import type { SessionUser } from "./auth";

/**
 * Almacenamiento de ficheros. Driver local (BID_DATA_DIR/uploads).
 * TODO producción: driver S3-compatible con la misma interfaz (put/get) y URLs firmadas.
 *
 * Las claves codifican el permiso de lectura:
 *   logos/<companyId>/<uuid>.<ext>     → cualquier usuario con sesión (se muestran en perfiles públicos)
 *   certs|docs|projects/<companyId>/…  → la propia empresa y el equipo BID
 */

export type Area = "logos" | "certs" | "docs" | "projects";

const MAX_BYTES = 10 * 1024 * 1024;

const ALLOWED: Record<Area, { exts: string[]; label: string }> = {
  logos: { exts: ["png", "jpg", "jpeg", "svg", "webp"], label: "una imagen PNG, SVG o JPG" },
  certs: { exts: ["pdf"], label: "un PDF" },
  docs: { exts: ["pdf"], label: "un PDF" },
  projects: { exts: ["pdf", "dwg", "dxf", "zip", "jpg", "jpeg", "png"], label: "PDF, DWG o imágenes" },
};

export const MIME: Record<string, string> = {
  pdf: "application/pdf",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  svg: "image/svg+xml",
  webp: "image/webp",
  dwg: "application/acad",
  dxf: "application/dxf",
  zip: "application/zip",
};

const root = () => path.join(dataDir(), "uploads");

export class UploadError extends Error {}

export function isFile(v: FormDataEntryValue | null): v is File {
  return typeof v === "object" && v !== null && "arrayBuffer" in v && (v as File).size > 0;
}

export async function putFile(area: Area, companyId: string, file: File): Promise<string> {
  const ext = (file.name.split(".").pop() ?? "").toLowerCase();
  if (!ALLOWED[area].exts.includes(ext)) throw new UploadError(`${file.name}: debe ser ${ALLOWED[area].label}.`);
  if (file.size > MAX_BYTES) throw new UploadError(`${file.name} supera los 10 MB.`);
  const key = `${area}/${companyId}/${randomUUID()}.${ext}`;
  const full = path.join(root(), key);
  await mkdir(path.dirname(full), { recursive: true });
  await writeFile(full, Buffer.from(await file.arrayBuffer()));
  return key;
}

const KEY_RE = /^(logos|certs|docs|projects)\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.[a-z0-9]+$/;

export function canRead(key: string, user: SessionUser | null) {
  if (!user || !KEY_RE.test(key)) return false;
  const [area, companyId] = key.split("/");
  if (area === "logos") return true;
  return user.role === "admin" || user.companyId === companyId;
}

export async function getFile(key: string) {
  if (!KEY_RE.test(key)) return null;
  try {
    return await readFile(path.join(root(), key));
  } catch {
    return null;
  }
}

export const fileUrl = (key: string | null | undefined) => (key ? "/api/files/" + key : undefined);
