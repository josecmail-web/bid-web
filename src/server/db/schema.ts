import {
  boolean,
  index,
  doublePrecision,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgSequence,
  pgTable,
  primaryKey,
  real,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

/* — enums — */

export const companyType = pgEnum("company_type", ["promotora", "industrial"]);
export const userRole = pgEnum("user_role", ["promotora", "industrial", "admin"]);
export const verificationStatus = pgEnum("verification_status", ["pending", "approved", "rejected"]);
export const certStatus = pgEnum("cert_status", ["pending", "ok", "rejected"]);
export const tenderStatus = pgEnum("tender_status", ["borrador", "abierta", "evaluacion", "adjudicada"]);
export const reportStatus = pgEnum("report_status", ["open", "kept", "hidden"]);

const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const money = (name: string) => numeric(name, { precision: 14, scale: 2, mode: "number" });

/* — empresas y usuarios — */

export const companies = pgTable("companies", {
  id: uuid("id").primaryKey().defaultRandom(),
  type: companyType("type").notNull(),
  /** Promotora | Constructora | Ambas (solo promotoras) */
  kind: text("kind"),
  name: text("name").notNull(),
  cif: text("cif").notNull().unique(),
  province: text("province").notNull(),
  city: text("city"),
  email: text("email").notNull(),
  annualVolume: text("annual_volume"),
  /** Oficios del industrial (Sector[]) */
  trades: jsonb("trades").$type<string[]>().notNull().default([]),
  /** Provincia | Comunidad | Nacional */
  radius: text("radius"),
  foundedYear: integer("founded_year"),
  verification: verificationStatus("verification").notNull().default("pending"),
  verifiedAt: timestamp("verified_at", { withTimezone: true }),
  createdAt: createdAt(),
});

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: userRole("role").notNull(),
  companyId: uuid("company_id").references(() => companies.id, { onDelete: "cascade" }),
  lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
  /** aceptación de las condiciones de uso (versión y fecha) */
  termsVersion: text("terms_version"),
  termsAcceptedAt: timestamp("terms_accepted_at", { withTimezone: true }),
  createdAt: createdAt(),
});

export const authTokenKind = pgEnum("auth_token_kind", ["reset", "invite"]);

/** Enlaces de un solo uso: recuperar contraseña e invitaciones a una empresa. Se guarda el sha256. */
export const authTokens = pgTable("auth_tokens", {
  id: text("id").primaryKey(),
  kind: authTokenKind("kind").notNull(),
  email: text("email").notNull(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
  companyId: uuid("company_id").references(() => companies.id, { onDelete: "cascade" }),
  createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  usedAt: timestamp("used_at", { withTimezone: true }),
  createdAt: createdAt(),
});

/** Intentos de acceso y de recuperación, para limitar la fuerza bruta. */
export const authAttempts = pgTable(
  "auth_attempts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** login | reset */
    action: text("action").notNull(),
    email: text("email").notNull(),
    ip: text("ip").notNull(),
    success: boolean("success").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("auth_attempts_email_idx").on(t.email, t.createdAt), index("auth_attempts_ip_idx").on(t.ip, t.createdAt)],
);

export const sessions = pgTable("sessions", {
  /** sha256 del token de la cookie */
  id: text("id").primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: createdAt(),
});

/** Documentación de alta (CIF, REA, Seguro RC, Escrituras, Poder notarial). */
export const companyDocs = pgTable("company_docs", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id")
    .notNull()
    .references(() => companies.id, { onDelete: "cascade" }),
  kind: text("kind").notNull(),
  fileKey: text("file_key"),
  fileName: text("file_name"),
  uploadedAt: createdAt(),
});

export const certificates = pgTable(
  "certificates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    /** CertId */
    certType: text("cert_type").notNull(),
    status: certStatus("status").notNull().default("pending"),
    /** "YYYY-MM" */
    expiresAt: text("expires_at").notNull(),
    logoKey: text("logo_key"),
    pdfKey: text("pdf_key"),
    reviewedBy: uuid("reviewed_by").references(() => users.id, { onDelete: "set null" }),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [unique().on(t.companyId, t.certType)],
);

/* — obras, paquetes (licitaciones) y partidas — */

export const projects = pgTable("projects", {
  id: uuid("id").primaryKey().defaultRandom(),
  ownerId: uuid("owner_id")
    .notNull()
    .references(() => companies.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  location: text("location").notNull(),
  /** "YYYY-MM" */
  startMonth: text("start_month"),
  description: text("description"),
  createdAt: createdAt(),
});

export const projectFiles = pgTable("project_files", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  fileKey: text("file_key").notNull(),
  fileName: text("file_name").notNull(),
  createdAt: createdAt(),
});

export const tenderNumberSeq = pgSequence("tender_number_seq", { startWith: 1 });

export const tenders = pgTable("tenders", {
  /** "LIC-0241" */
  id: text("id").primaryKey(),
  number: integer("number").notNull().unique(),
  ownerId: uuid("owner_id")
    .notNull()
    .references(() => companies.id, { onDelete: "cascade" }),
  /** null en borradores */
  projectId: uuid("project_id").references(() => projects.id, { onDelete: "cascade" }),
  sector: text("sector").notNull(),
  title: text("title").notNull(),
  status: tenderStatus("status").notNull(),
  closesAt: timestamp("closes_at", { withTimezone: true }),
  referenceBudget: money("reference_budget"),
  /** abierta | invitacion */
  scope: text("scope").notNull().default("abierta"),
  minRating: real("min_rating"),
  requiredCerts: jsonb("required_certs").$type<string[]>().notNull().default([]),
  awardedBidId: uuid("awarded_bid_id"),
  /** Estado completo del asistente (solo borradores) */
  draft: jsonb("draft"),
  createdAt: createdAt(),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  awardedAt: timestamp("awarded_at", { withTimezone: true }),
});

export const tenderItems = pgTable("tender_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenderId: text("tender_id")
    .notNull()
    .references(() => tenders.id, { onDelete: "cascade" }),
  position: integer("position").notNull(),
  code: text("code").notNull(),
  description: text("description").notNull(),
  unit: text("unit").notNull(),
  quantity: doublePrecision("quantity").notNull(),
  chapter: text("chapter"),
});

/* — pujas — */

export const bids = pgTable(
  "bids",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenderId: text("tender_id")
      .notNull()
      .references(() => tenders.id, { onDelete: "cascade" }),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    submittedAt: createdAt(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique().on(t.tenderId, t.companyId)],
);

export const bidItems = pgTable(
  "bid_items",
  {
    bidId: uuid("bid_id")
      .notNull()
      .references(() => bids.id, { onDelete: "cascade" }),
    tenderItemId: uuid("tender_item_id")
      .notNull()
      .references(() => tenderItems.id, { onDelete: "cascade" }),
    unitPrice: money("unit_price").notNull(),
  },
  (t) => [primaryKey({ columns: [t.bidId, t.tenderItemId] })],
);

/* — comisiones (ver src/lib/pricing.ts) — */

export const feeStatus = pgEnum("fee_status", ["waived_pilot", "pending", "invoiced", "paid", "cancelled"]);

/** Comisión de cada adjudicación. En el piloto se registra como exenta (lo que se habría cobrado). */
export const awardFees = pgTable("award_fees", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenderId: text("tender_id")
    .notNull()
    .unique()
    .references(() => tenders.id, { onDelete: "cascade" }),
  bidId: uuid("bid_id")
    .notNull()
    .references(() => bids.id, { onDelete: "cascade" }),
  companyId: uuid("company_id")
    .notNull()
    .references(() => companies.id, { onDelete: "cascade" }),
  awardedTotal: money("awarded_total").notNull(),
  rate: real("rate").notNull(),
  feeAmount: money("fee_amount").notNull(),
  chargedAmount: money("charged_amount").notNull(),
  status: feeStatus("status").notNull(),
  tariffVersion: text("tariff_version").notNull(),
  createdAt: createdAt(),
});

/* — valoraciones — */

export const reviews = pgTable("reviews", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenderId: text("tender_id").references(() => tenders.id, { onDelete: "set null" }),
  fromCompanyId: uuid("from_company_id")
    .notNull()
    .references(() => companies.id, { onDelete: "cascade" }),
  toCompanyId: uuid("to_company_id")
    .notNull()
    .references(() => companies.id, { onDelete: "cascade" }),
  obra: text("obra").notNull(),
  quality: real("quality").notNull(),
  deadlines: real("deadlines").notNull(),
  cleanliness: real("cleanliness").notNull(),
  treatment: real("treatment").notNull(),
  comment: text("comment"),
  hidden: boolean("hidden").notNull().default(false),
  createdAt: createdAt(),
}, (t) => [
  // Una valoración por paquete y promotora (las históricas sin paquete no cuentan: NULL ≠ NULL)
  unique("reviews_tender_from_unique").on(t.tenderId, t.fromCompanyId),
]);

export const reviewReports = pgTable("review_reports", {
  id: uuid("id").primaryKey().defaultRandom(),
  reviewId: uuid("review_id")
    .notNull()
    .references(() => reviews.id, { onDelete: "cascade" }),
  reason: text("reason").notNull(),
  status: reportStatus("status").notNull().default("open"),
  createdAt: createdAt(),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
});

/* — notificaciones (in-app; el email sale de src/server/notify.ts) — */

export const notifications = pgTable("notifications", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id")
    .notNull()
    .references(() => companies.id, { onDelete: "cascade" }),
  kind: text("kind").notNull(),
  message: text("message").notNull(),
  link: text("link"),
  createdAt: createdAt(),
  readAt: timestamp("read_at", { withTimezone: true }),
});
