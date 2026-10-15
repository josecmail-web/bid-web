"use server";

import { and, eq, ilike, inArray, ne, or, sql } from "drizzle-orm";
import { refresh } from "next/cache";
import { getSession, requireAction } from "../auth";
import { getDb, schema as s, type DB } from "../db";
import { isFile, putFile } from "../storage";
import { notify } from "../notify";
import { parseMeasurements } from "../excel";
import { eligibleIndustrials } from "../eligibility";
import { closeExpired, getIndustrialProfile } from "../queries";
import { safe, UserError } from "../action-utils";
import { bidTotal, recordAwardFee } from "../fees";
import { tanteoActive } from "../tanteo";
import { PILOT, TARIFF_TEXT } from "@/lib/pricing";
import { closeLabel, eur, eur2 } from "@/lib/format";
import { EXTRA_CERTS, SECTOR_NAMES, TITLE, reqFor } from "@/lib/catalog";
import { MIN_RATING, TANTEO_HOURS, TANTEO_MAX, validateWizardStep } from "@/lib/rules";
import type { ImportResult } from "@/lib/import";
import type { ActionResult, IndustrialProfileDTO, ReviewInput, Sector, TanteoPick, WizardFile, WizardState } from "@/lib/types";

const tenderId = (n: number) => "LIC-" + String(n).padStart(4, "0");

async function nextNumber(db: DB) {
  const r = await db.execute<{ n: number }>(sql`select nextval('tender_number_seq')::int as n`);
  return Number(r.rows[0].n);
}

async function requireVerified() {
  const user = await requireAction("promotora");
  if (user.verification !== "approved") throw new UserError("Tu empresa está pendiente de verificación: podrás publicar cuando Bidra la apruebe.");
  return user;
}

/** Lee el Excel de mediciones en el servidor y devuelve las partidas clasificadas. */
export async function parseExcel(fd: FormData): Promise<ImportResult | { ok: false; error: string }> {
  return safe(async () => {
    await requireAction("promotora");
    const file = fd.get("file");
    if (!isFile(file)) throw new UserError("Selecciona un fichero.");
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
    if (ext === "pdf") throw new UserError("La importación desde PDF llegará pronto. De momento, sube un Excel.");
    if (!["xlsx", "xls", "csv"].includes(ext)) throw new UserError("Sube un fichero .xlsx, .xls o .csv.");
    if (file.size > 10 * 1024 * 1024) throw new UserError(file.name + " supera los 10 MB.");
    return parseMeasurements(file);
  }) as Promise<ImportResult | { ok: false; error: string }>;
}

export async function uploadProjectFile(fd: FormData): Promise<ActionResult<{ file: WizardFile }>> {
  return safe(async () => {
    const user = await requireAction("promotora");
    const file = fd.get("file");
    if (!isFile(file)) throw new UserError("Selecciona un fichero.");
    return { ok: true, file: { key: await putFile("projects", user.companyId, file), name: file.name } };
  });
}

/** Limpia lo que llega del cliente: solo campos conocidos y tamaños razonables. */
function sanitize(w: WizardState, companyId: string): WizardState {
  const cut = (x: unknown, n = 300) => String(x ?? "").slice(0, n);
  const partidas = (Array.isArray(w.partidas) ? w.partidas : []).slice(0, 2000).map((p, i) => ({
    id: Number(p.id) || i + 1,
    code: cut(p.code, 40),
    d: cut(p.d, 1000),
    u: cut(p.u, 10) || "ud",
    q: Number.isFinite(Number(p.q)) ? Math.max(0, Number(p.q)) : 0,
    sector: (SECTOR_NAMES as string[]).includes(p.sector) ? p.sector : "",
    on: !!p.on,
    chapter: p.chapter ? cut(p.chapter, 300) : undefined,
    long: p.long ? cut(p.long, 8000) : undefined,
  })) as WizardState["partidas"];
  return {
    step: 0,
    draftId: w.draftId ? cut(w.draftId, 12) : null,
    obra: cut(w.obra, 200),
    loc: cut(w.loc, 200),
    start: /^\d{4}-\d{2}$/.test(w.start) ? w.start : "",
    desc: cut(w.desc, 5000),
    files: (Array.isArray(w.files) ? w.files : []).filter((f) => typeof f?.key === "string" && f.key.startsWith(`projects/${companyId}/`)).slice(0, 50).map((f) => ({ key: f.key, name: cut(f.name, 200) })),
    partidas,
    fileName: cut(w.fileName, 200),
    importNote: cut(w.importNote, 300),
    close: cut(w.close, 20),
    // Los paquetes por invitación aún no existen (nadie podría verlos): siempre abiertos
    scope: "abierta",
    min: (["Cualquiera", "3+", "4+", "4,5+"] as const).includes(w.min) ? w.min : "Cualquiera",
    refs: Object.fromEntries(Object.entries(w.refs ?? {}).filter(([k]) => (SECTOR_NAMES as string[]).includes(k)).map(([k, v]) => [k, cut(v, 20)])),
    extra: (Array.isArray(w.extra) ? w.extra : []).filter((x) => EXTRA_CERTS.includes(x)),
    // Solo id + datos de pantalla; al publicar se comprueba contra la base de datos
    tanteo: (Array.isArray(w.tanteo) ? w.tanteo : [])
      .filter((p) => typeof p?.id === "string" && /^[0-9a-f-]{36}$/.test(p.id))
      .slice(0, TANTEO_MAX)
      .map((p) => ({ id: p.id, name: cut(p.name, 200), city: cut(p.city, 100), trades: (Array.isArray(p.trades) ? p.trades : []).map((x) => cut(x, 60)).slice(0, 20) })),
  };
}

/** Industriales verificados para darles derecho de tanteo (búsqueda por nombre o CIF). */
export async function searchIndustriales(q: string): Promise<ActionResult<{ results: TanteoPick[] }>> {
  return safe(async () => {
    await requireAction("promotora");
    const term = String(q ?? "").trim().slice(0, 80);
    if (term.length < 2) return { ok: true, results: [] };
    const like = "%" + term.replace(/[\\%_]/g, (c) => "\\" + c) + "%";
    const db = await getDb();
    const rows = await db
      .select({ id: s.companies.id, name: s.companies.name, city: s.companies.city, province: s.companies.province, trades: s.companies.trades })
      .from(s.companies)
      .where(and(eq(s.companies.type, "industrial"), eq(s.companies.verification, "approved"), or(ilike(s.companies.name, like), ilike(s.companies.cif, like))))
      .orderBy(s.companies.name)
      .limit(10);
    return { ok: true, results: rows.map((r) => ({ id: r.id, name: r.name, city: r.city && r.city !== r.province ? `${r.city}, ${r.province}` : (r.city ?? r.province), trades: r.trades })) };
  });
}

const usedSectors = (w: WizardState) => SECTOR_NAMES.filter((n) => w.partidas.some((p) => p.on && p.sector === n));

export async function saveDraft(input: WizardState): Promise<ActionResult<{ id: string }>> {
  return safe(async () => {
    const user = await requireAction("promotora");
    const w = sanitize(input, user.companyId);
    const db = await getDb();
    const secs = usedSectors(w);
    const summary = {
      title: secs.length > 1 ? secs.length + " sectores" : secs[0] ? TITLE[secs[0]] : "Sin partidas",
      sector: secs.length > 1 ? "Varios sectores" : (secs[0] ?? "—"),
    };
    let id = w.draftId;
    if (id) {
      const [t] = await db.select({ status: s.tenders.status }).from(s.tenders).where(and(eq(s.tenders.id, id), eq(s.tenders.ownerId, user.companyId)));
      if (t?.status !== "borrador") id = null;
    }
    if (id) {
      await db.update(s.tenders).set({ ...summary, draft: { ...w, draftId: id } }).where(eq(s.tenders.id, id));
    } else {
      const n = await nextNumber(db);
      id = tenderId(n);
      await db.insert(s.tenders).values({ id, number: n, ownerId: user.companyId, status: "borrador", requiredCerts: ["rea"], ...summary, draft: { ...w, draftId: id } });
    }
    refresh();
    return { ok: true, id };
  });
}

/** Publica un paquete por sector. `closeIso` es el cierre en ISO (convertido desde la hora local del navegador). */
export async function publishTenders(input: WizardState, closeIso: string): Promise<ActionResult<{ ids: string[]; sectors: string[] }>> {
  return safe(async () => {
    const user = await requireVerified();
    const w = sanitize(input, user.companyId);
    for (const step of [0, 1]) {
      const err = validateWizardStep(w, step);
      if (err) throw new UserError(err);
    }
    const closesAt = new Date(closeIso);
    if (!Number.isFinite(closesAt.getTime()) || closesAt.getTime() <= Date.now() + 3600e3) throw new UserError("El cierre de la puja debe ser al menos dentro de una hora.");

    const db = await getDb();
    const secs = usedSectors(w) as Sector[];
    const inc = w.partidas.filter((p) => p.on);
    const minRating = MIN_RATING[w.min];
    const holders = w.tanteo.length
      ? await db
          .select({ id: s.companies.id, trades: s.companies.trades })
          .from(s.companies)
          .where(and(inArray(s.companies.id, w.tanteo.map((p) => p.id)), eq(s.companies.type, "industrial"), eq(s.companies.verification, "approved")))
      : [];

    const created = await db.transaction(async (tx) => {
      const [existing] = await tx.select().from(s.projects).where(and(eq(s.projects.ownerId, user.companyId), eq(s.projects.name, w.obra)));
      const projectId =
        existing?.id ??
        (await tx.insert(s.projects).values({ ownerId: user.companyId, name: w.obra, location: w.loc, startMonth: w.start || null, description: w.desc || null }).returning({ id: s.projects.id }))[0].id;
      if (w.files.length) await tx.insert(s.projectFiles).values(w.files.map((f) => ({ projectId, fileKey: f.key, fileName: f.name })));

      const out: { id: string; sector: Sector; req: string[]; tanteoIds: string[] }[] = [];
      for (const sec of secs) {
        const n = await nextNumber(tx as unknown as DB);
        const id = tenderId(n);
        const req = reqFor(sec, w.extra);
        const ref = Number(w.refs[sec]);
        await tx.insert(s.tenders).values({
          id, number: n, ownerId: user.companyId, projectId, sector: sec, title: TITLE[sec], status: "abierta", closesAt,
          referenceBudget: ref > 0 ? ref : null, scope: w.scope, minRating, requiredCerts: req, publishedAt: new Date(),
        });
        await tx.insert(s.tenderItems).values(
          inc.filter((p) => p.sector === sec).map((p, position) => ({ tenderId: id, position, code: p.code, description: p.d, longDescription: p.long ?? null, unit: p.u, quantity: p.q, chapter: p.chapter ?? null })),
        );
        const tanteoIds = holders.filter((h) => h.trades.includes(sec)).map((h) => h.id);
        if (tanteoIds.length) await tx.insert(s.tenderTanteo).values(tanteoIds.map((companyId) => ({ tenderId: id, companyId })));
        out.push({ id, sector: sec, req, tanteoIds });
      }
      if (w.draftId) await tx.delete(s.tenders).where(and(eq(s.tenders.id, w.draftId), eq(s.tenders.ownerId, user.companyId), eq(s.tenders.status, "borrador")));
      return out;
    });

    // Aviso a los industriales que pueden pujar cada paquete
    for (const t of created) {
      if (w.scope === "invitacion") continue; // TODO: invitaciones a industriales concretos
      const ids = await eligibleIndustrials(db, t.sector, t.req, minRating);
      const tanteoNote = t.tanteoIds.length ? ` Tiene derecho de tanteo: uno o varios industriales podrán igualar la mejor oferta en las ${TANTEO_HOURS} h siguientes al cierre.` : "";
      await notify(db, ids.filter((x) => !t.tanteoIds.includes(x)), "tender_published", `Nuevo paquete de ${t.sector}: ${TITLE[t.sector]} · ${w.obra} (${t.id}).${tanteoNote}`, `/industrial/paquetes/${t.id}`);
      // Titulares: aviso propio (aunque aún les falte algún requisito, para que lo resuelvan antes del cierre)
      await notify(
        db, t.tanteoIds, "tanteo_granted",
        `${user.companyName} te da derecho de tanteo en ${t.id} · ${TITLE[t.sector]} (${w.obra}). Para ejercerlo, presenta tu oferta antes del cierre, ${closeLabel(closesAt.toISOString())}: si no es la más baja, tendrás ${TANTEO_HOURS} h para igualar la mejor.`,
        `/industrial/paquetes/${t.id}`,
      );
    }
    refresh();
    return { ok: true, ids: created.map((t) => t.id), sectors: created.map((t) => t.sector) };
  });
}

export async function awardTender(tenderIdArg: string, companyId: string): Promise<ActionResult<{ name: string }>> {
  return safe(async () => {
    const user = await requireAction("promotora");
    const db = await getDb();
    await closeExpired(db);
    const [t] = await db.select().from(s.tenders).where(and(eq(s.tenders.id, tenderIdArg), eq(s.tenders.ownerId, user.companyId)));
    if (!t) throw new UserError("Partida no encontrada.");
    if (t.status !== "evaluacion") throw new UserError(t.status === "adjudicada" ? "Esta partida ya está adjudicada." : "La puja aún no ha cerrado.");
    if (await tanteoActive(db, t.id, t.tanteoUntil))
      throw new UserError(`Hay un derecho de tanteo en curso hasta el ${closeLabel(t.tanteoUntil!.toISOString())}. Podrás adjudicar cuando respondan los titulares o termine el plazo.`);
    const [bid] = await db
      .select({ id: s.bids.id, name: s.companies.name })
      .from(s.bids)
      .innerJoin(s.companies, eq(s.companies.id, s.bids.companyId))
      .where(and(eq(s.bids.tenderId, t.id), eq(s.bids.companyId, companyId)));
    if (!bid) throw new UserError("Esa empresa no ha pujado en esta partida.");
    const updated = await db
      .update(s.tenders)
      .set({ status: "adjudicada", awardedBidId: bid.id, awardedAt: new Date() })
      .where(and(eq(s.tenders.id, t.id), eq(s.tenders.status, "evaluacion")))
      .returning({ id: s.tenders.id });
    if (!updated.length) throw new UserError("Esta partida ya está adjudicada.");

    const total = await bidTotal(db, bid.id);
    const fee = await recordAwardFee(db, { tenderId: t.id, bidId: bid.id, companyId, total });
    const feeText = PILOT
      ? ` Comisión Bidra: ${eur2(fee.fee)}, exenta durante el piloto.`
      : ` Comisión Bidra: ${eur2(fee.fee)} (${TARIFF_TEXT}).`;

    const losers = await db.select({ id: s.bids.companyId }).from(s.bids).where(and(eq(s.bids.tenderId, t.id), ne(s.bids.companyId, companyId)));
    await notify(db, [companyId], "tender_awarded", `Te han adjudicado ${t.id} · ${t.title} por ${eur(total)}.${feeText}`, `/industrial/paquetes/${t.id}`);
    // Sin importes: el resto solo sabe que no ha sido adjudicado
    await notify(db, losers.map((l) => l.id), "tender_not_awarded", `${t.id} · ${t.title} se ha adjudicado a otra empresa.`, `/industrial/paquetes/${t.id}`);
    refresh();
    return { ok: true, name: bid.name };
  });
}

/** Perfil público de un industrial (drawer). Cualquier usuario con sesión. */
export async function fetchIndustrialProfile(companyId: string): Promise<ActionResult<{ profile: IndustrialProfileDTO }>> {
  return safe(async () => {
    if (!(await getSession())) throw new UserError("Inicia sesión.");
    const profile = await getIndustrialProfile(companyId);
    if (!profile) throw new UserError("Perfil no encontrado.");
    return { ok: true, profile };
  });
}

/**
 * Valoración del adjudicatario de un paquete (una sola vez, no editable). La media pública del
 * industrial se recalcula sola: se calcula a partir de las valoraciones no ocultas.
 */
export async function submitReview(tenderIdArg: string, input: ReviewInput): Promise<ActionResult<{ name: string; avg: number }>> {
  return safe(async () => {
    const user = await requireAction("promotora");
    const scores = [input.quality, input.deadlines, input.cleanliness, input.treatment];
    if (scores.some((v) => !Number.isInteger(v) || v < 1 || v > 5)) throw new UserError("Puntúa las cuatro categorías de 1 a 5 estrellas.");
    const comment = String(input.comment ?? "").trim().slice(0, 1000);
    if (comment && comment.length < 10) throw new UserError("El comentario es demasiado corto (mínimo 10 caracteres), o déjalo vacío.");

    const db = await getDb();
    const [t] = await db
      .select({ t: s.tenders, obra: s.projects.name })
      .from(s.tenders)
      .leftJoin(s.projects, eq(s.projects.id, s.tenders.projectId))
      .where(and(eq(s.tenders.id, tenderIdArg), eq(s.tenders.ownerId, user.companyId)));
    if (!t) throw new UserError("Partida no encontrada.");
    if (t.t.status !== "adjudicada" || !t.t.awardedBidId) throw new UserError("Solo puedes valorar partidas adjudicadas.");
    const [bid] = await db
      .select({ companyId: s.bids.companyId, name: s.companies.name })
      .from(s.bids)
      .innerJoin(s.companies, eq(s.companies.id, s.bids.companyId))
      .where(eq(s.bids.id, t.t.awardedBidId));

    const inserted = await db
      .insert(s.reviews)
      .values({
        tenderId: t.t.id, fromCompanyId: user.companyId, toCompanyId: bid.companyId, obra: t.obra ?? t.t.title,
        quality: scores[0], deadlines: scores[1], cleanliness: scores[2], treatment: scores[3], comment: comment || null,
      })
      .onConflictDoNothing()
      .returning({ id: s.reviews.id });
    if (!inserted.length) throw new UserError("Ya has valorado esta partida.");

    const avg = (scores[0] + scores[1] + scores[2] + scores[3]) / 4;
    await notify(db, [bid.companyId], "review_received", `${user.companyName} te ha valorado con ${avg.toFixed(1).replace(".", ",")} ★ por ${t.t.id} · ${t.obra ?? t.t.title}.`, "/industrial/perfil");
    refresh();
    return { ok: true, name: bid.name, avg };
  });
}
