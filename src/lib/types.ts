/* Tipos compartidos cliente/servidor. Los *DTO son lo que el servidor entrega a la UI:
   nunca incluyen datos que el usuario no deba ver (p. ej. importes de pujas antes del cierre). */

export type Role = "promotora" | "industrial" | "admin";

export type CertId = "rea" | "iso9001" | "iso14001" | "iso45001" | "ibt" | "rite" | "fgas" | "fon" | "ce" | "sold";

export type Sector =
  | "Movimiento de tierras"
  | "Estructuras"
  | "Albañilería"
  | "Impermeabilización"
  | "Fontanería"
  | "Electricidad"
  | "Climatización"
  | "Carpintería"
  | "Cerrajería"
  | "Pladur"
  | "Revestimientos"
  | "Pintura";

/** "" = sin clasificar */
export type SectorOrNone = Sector | "";

export type Unit = string;

export type TenderStatus = "borrador" | "abierta" | "evaluacion" | "adjudicada";

/**
 * Derecho de tanteo de un titular: holder (puja abierta) → al cierre: best (ya es la mejor oferta),
 * nobid (no pujó, lo pierde) o pending (puede igualar 72 h) → matched | declined | expired.
 */
export type TanteoStatus = "holder" | "best" | "pending" | "matched" | "declined" | "expired" | "nobid";

/** Industrial elegido como titular del tanteo en el asistente. */
export interface TanteoPick {
  id: string;
  name: string;
  city: string;
  trades: string[];
}

export type CertStatus = "pending" | "ok" | "rejected";

/** [Calidad, Plazos, Limpieza, Trato] */
export type Ratings = [number, number, number, number];

export type ActionResult<T = object> = ({ ok: true } & T) | { ok: false; error: string };

export interface ShellUser {
  role: Role;
  email: string;
  companyName: string;
  verification: "pending" | "approved" | "rejected" | null;
  demo: boolean;
}

export interface CertDTO {
  id: CertId;
  st: CertStatus;
  /** "YYYY-MM" */
  exp: string;
  /** URL del logotipo subido */
  logo?: string;
}

export interface ReviewDTO {
  by: string;
  obra: string;
  date: string;
  r: Ratings;
  text: string;
}

export interface IndustrialProfileDTO {
  id: string;
  name: string;
  city: string;
  since: number | null;
  trades: string[];
  /** obras valoradas */
  jobs: number;
  r: Ratings | null;
  /** solo certificados validados y vigentes */
  certs: CertDTO[];
  /** solo valoraciones con comentario, más recientes primero */
  reviews: ReviewDTO[];
}

export interface TenderItem {
  code: string;
  d: string;
  /** descripción técnica completa, si la trae el Excel */
  long?: string;
  u: Unit;
  q: number;
}

export interface TenderCardDTO {
  id: string;
  title: string;
  obra: string;
  loc: string;
  sector: string;
  status: TenderStatus;
  closesAt: string | null;
  itemCount: number;
  /** nº de sobres (pujas) — lo único que se sabe de las pujas mientras está abierta */
  sealed: number;
  minTotal: number | null;
  awardedName: string | null;
  awardedTotal: number | null;
  /** adjudicada y aún sin valorar por la promotora */
  needsReview: boolean;
  /** plazo de tanteo en curso (no se puede adjudicar hasta entonces) */
  tanteoUntil: string | null;
}

export interface BidderDTO {
  id: string;
  name: string;
  city: string;
  jobs: number;
  r: Ratings | null;
  certCodes: string[];
}

export interface TenderDetailDTO {
  id: string;
  title: string;
  obra: string;
  loc: string;
  sector: string;
  status: TenderStatus;
  closesAt: string | null;
  ref: number | null;
  req: CertId[];
  items: TenderItem[];
  sealed: number;
  /** vacío mientras la puja está abierta (puja ciega) */
  bids: { bidder: BidderDTO; p: number[] }[];
  awardedCompanyId: string | null;
  /** valoración de la promotora al adjudicatario (si ya la ha hecho) */
  review: GivenReviewDTO | null;
  /** derecho de tanteo: titulares y plazo (null si el paquete no tiene) */
  tanteo: {
    holders: { id: string; name: string; status: TanteoStatus; original: number | null; best: number | null }[];
    /** fin del plazo para igualar; mientras esté activo no se puede adjudicar */
    until: string | null;
    active: boolean;
  } | null;
}

export interface GivenReviewDTO {
  r: Ratings;
  comment: string | null;
  date: string;
}

export interface ReviewInput {
  quality: number;
  deadlines: number;
  cleanliness: number;
  treatment: number;
  comment: string;
}

/** Valoración recibida, vista por el propio industrial (incluye ocultas y estado del reporte). */
export interface ReceivedReviewDTO {
  id: string;
  by: string;
  obra: string;
  tenderId: string | null;
  date: string;
  r: Ratings;
  text: string | null;
  hidden: boolean;
  report: { status: "open" | "kept" | "hidden"; reason: string } | null;
}

export interface WizardRow {
  id: number;
  code: string;
  d: string;
  u: Unit;
  q: number;
  sector: SectorOrNone;
  on: boolean;
  chapter?: string;
  /** descripción técnica completa, si la trae el Excel */
  long?: string;
}

export interface WizardFile {
  key: string;
  name: string;
}

export interface WizardState {
  step: number;
  draftId: string | null;
  obra: string;
  loc: string;
  start: string;
  desc: string;
  files: WizardFile[];
  partidas: WizardRow[];
  fileName: string;
  importNote: string;
  /** "YYYY-MM-DDTHH:mm" hora local */
  close: string;
  scope: "abierta" | "invitacion";
  min: "Cualquiera" | "3+" | "4+" | "4,5+";
  refs: Record<string, string>;
  extra: CertId[];
  /** titulares del derecho de tanteo (cada uno solo en los paquetes de sus sectores) */
  tanteo: TanteoPick[];
}

export interface VerificationDTO {
  id: string;
  name: string;
  type: string;
  cif: string;
  prov: string;
  date: string;
  docs: { kind: string; ok: boolean; url?: string }[];
}

export interface PendingCertDTO {
  companyId: string;
  companyName: string;
  cert: CertDTO;
  pdf?: string;
}

export interface FlaggedReviewDTO {
  id: string;
  ind: string;
  by: string;
  obra: string;
  score: number;
  text: string;
  reason: string;
}

export interface AdminTenderRow {
  id: string;
  title: string;
  owner: string;
  prov: string;
  status: TenderStatus;
  n: number;
  closesAt: string | null;
}

export interface FeeRowDTO {
  tenderId: string;
  title: string;
  owner: string;
  industrial: string;
  date: string;
  total: number;
  fee: number;
  charged: number;
  status: "waived_pilot" | "pending" | "invoiced" | "paid" | "cancelled";
}

export interface AdminDataDTO {
  kpis: { verifs: number; open: number; bids7d: number; flagged: number };
  fees: { rows: FeeRowDTO[]; totals: { n: number; awarded: number; fee: number; charged: number } };
  verifs: VerificationDTO[];
  pendingCerts: PendingCertDTO[];
  tenders: AdminTenderRow[];
  flagged: FlaggedReviewDTO[];
}

/* — industrial — */

/** Resultado para el industrial: sin importes ni identidades de terceros. */
export type BidResult = "won" | "lost" | null;

export interface IndustrialTenderCardDTO {
  id: string;
  title: string;
  owner: string;
  obra: string;
  loc: string;
  sector: string;
  status: TenderStatus;
  closesAt: string | null;
  itemCount: number;
  req: CertId[];
  minRating: number | null;
  /** puede pujar (o pudo, si ya cerró) */
  eligible: boolean;
  /** certificados exigidos que no tiene validados y vigentes */
  missing: CertId[];
  /** de esos, los que ya están en revisión */
  missingPending: CertId[];
  ratingTooLow: boolean;
  myBid: { total: number; updatedAt: string } | null;
  result: BidResult;
  /** el paquete tiene derecho de tanteo (se avisa a todos, sin decir quién lo tiene) */
  tanteo: boolean;
  /** mi derecho de tanteo en este paquete, si soy titular */
  myTanteo: { status: TanteoStatus; best: number | null; until: string | null } | null;
}

export interface IndustrialTenderDTO extends IndustrialTenderCardDTO {
  description: string | null;
  startMonth: string | null;
  files: { name: string; url: string }[];
  items: TenderItem[];
  /** mis precios unitarios, en el orden de items */
  myPrices: number[] | null;
  /** empresa verificada (si no, no puede enviar) */
  verified: boolean;
  /** valoración recibida por esta obra (si la ganó y ya le han valorado) */
  review: GivenReviewDTO | null;
  /** comisión registrada al adjudicársela (solo el adjudicatario) */
  fee: { amount: number; charged: number; status: string } | null;
}

/* — avisos — */

export interface NotificationDTO {
  id: string;
  kind: string;
  message: string;
  link: string | null;
  createdAt: string;
  read: boolean;
}

export interface NotificationsDTO {
  items: NotificationDTO[];
  unread: number;
}

/* — cuenta y equipo — */

export interface AccountDTO {
  me: { email: string; role: Role };
  company: {
    name: string;
    type: "promotora" | "industrial";
    cif: string;
    province: string;
    email: string;
    verification: "pending" | "approved" | "rejected";
    trades: string[];
  } | null;
  members: { id: string; email: string; isMe: boolean; lastLoginAt: string | null; createdAt: string }[];
  invites: { id: string; email: string; expiresAt: string; by: string | null }[];
}
