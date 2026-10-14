/** Datos ficticios de demostración (del prototipo del handoff, ampliados para que sean coherentes). */

export type R4 = [number, number, number, number];

export interface SeedReview {
  by: string;
  obra: string;
  /** "YYYY-MM" */
  month: string;
  r: R4;
  text: string;
}

export interface SeedCert {
  id: string;
  st: "ok" | "pending" | "rejected";
  exp: string;
}

export interface SeedIndustrial {
  key: string;
  name: string;
  city: string;
  province: string;
  since: number;
  trades: string[];
  /** media objetivo por categoría; null = sin valoraciones */
  r: R4 | null;
  /** obras valoradas en Bidra */
  jobs: number;
  certs: SeedCert[];
  reviews: SeedReview[];
}

export const DEMO_PASSWORD = "bid-demo-2026";

export const PROMOTORAS = [
  { key: "levante", name: "Grupo Levante Promociones", kind: "Promotora", province: "Valencia", city: "Valencia", email: "compras@grupolevante.es", cif: "B46123457", vol: "20–50 M€" },
  { key: "via", name: "Vía Promociones", kind: "Promotora", province: "Alicante", city: "Alicante", email: "obras@viapromociones.es", cif: "B03456781", vol: "5–20 M€" },
  { key: "rios", name: "Constructora Ríos", kind: "Constructora", province: "Valencia", city: "Valencia", email: "compras@constructorarios.es", cif: "A46987652", vol: "> 50 M€" },
  { key: "marazul", name: "Promociones Mar Azul", kind: "Ambas", province: "Castellón", city: "Castellón de la Plana", email: "tecnico@marazul.es", cif: "B12345674", vol: "5–20 M€" },
] as const;

export const DEMO_USERS = {
  promotora: { email: "compras@grupolevante.es", company: "levante" },
  industrial: { email: "obras@hidroturia.es", company: "h" },
  admin: { email: "equipo@bid.es" },
} as const;

const exp = (y: number, m: number) => `${y}-${String(m).padStart(2, "0")}`;

export const INDUSTRIALS: SeedIndustrial[] = [
  {
    key: "h", name: "Hidrosanitarias Turia S.L.", city: "Paterna", province: "Valencia", since: 2009, trades: ["Fontanería"], r: [4.8, 4.6, 4.7, 4.9], jobs: 37,
    certs: [{ id: "rea", st: "ok", exp: "2029-03" }, { id: "fon", st: "ok", exp: "2028-06" }, { id: "iso9001", st: "ok", exp: "2027-11" }, { id: "iso45001", st: "pending", exp: "2029-09" }],
    reviews: [
      { by: "Promociones Mar Azul", obra: "Edificio Alameda 3", month: "2026-06", r: [5, 4.5, 5, 5], text: "Equipo ordenado y muy resolutivo con los cambios de última hora en baños." },
      { by: "Constructora Ríos", obra: "Residencial Benimaclet", month: "2026-02", r: [4.5, 4.5, 4.5, 5], text: "Cumplieron el plan de obra. Documentación final completa." },
    ],
  },
  {
    key: "f", name: "Fontanería Albufera S.L.", city: "Sueca", province: "Valencia", since: 2016, trades: ["Fontanería"], r: [4.1, 3.6, 4.0, 4.3], jobs: 12,
    certs: [{ id: "rea", st: "ok", exp: "2028-01" }, { id: "fon", st: "ok", exp: "2027-04" }],
    reviews: [{ by: "Grupo Levante Promociones", obra: "Nave Ribarroja", month: "2026-03", r: [4, 3.5, 4, 4.5], text: "Buen acabado, pero hubo dos semanas de retraso en la red de saneamiento." }],
  },
  {
    key: "s", name: "Instalaciones Sorolla S.A.", city: "Valencia", province: "Valencia", since: 1998, trades: ["Fontanería", "Climatización"], r: [4.6, 4.8, 4.4, 4.5], jobs: 54,
    certs: [{ id: "rea", st: "ok", exp: "2028-10" }, { id: "fon", st: "ok", exp: "2029-02" }, { id: "iso9001", st: "ok", exp: "2028-05" }, { id: "iso14001", st: "ok", exp: "2028-05" }, { id: "iso45001", st: "ok", exp: "2028-05" }],
    reviews: [
      { by: "Vía Promociones", obra: "Torre Marina", month: "2026-05", r: [4.5, 5, 4.5, 4.5], text: "Entregaron antes de plazo. Muy buena coordinación con el resto de oficios." },
      { by: "Constructora Ríos", obra: "Edificio Patraix", month: "2025-11", r: [4.5, 4.5, 4, 4.5], text: "Seria y fiable. Limpieza mejorable en zonas comunes." },
    ],
  },
  {
    key: "a", name: "Grupo Aquanet", city: "Alzira", province: "Valencia", since: 2021, trades: ["Fontanería"], r: [3.4, 3.1, 3.8, 3.9], jobs: 8,
    certs: [{ id: "rea", st: "ok", exp: "2027-08" }, { id: "fon", st: "ok", exp: "2026-12" }],
    reviews: [{ by: "Promociones Mar Azul", obra: "Residencial Xàtiva", month: "2026-01", r: [3, 3, 4, 4], text: "Precio ajustado, pero hicieron falta varias visitas para resolver fugas." }],
  },
  {
    key: "c", name: "Climafont Levante S.L.", city: "Manises", province: "Valencia", since: 2024, trades: ["Fontanería", "Climatización"], r: null, jobs: 0,
    certs: [{ id: "rea", st: "ok", exp: "2029-06" }, { id: "fon", st: "ok", exp: "2029-06" }, { id: "iso9001", st: "ok", exp: "2028-12" }, { id: "rite", st: "pending", exp: "2030-01" }],
    reviews: [],
  },
  {
    key: "i", name: "Impercubiertas Mediterráneo", city: "Picassent", province: "Valencia", since: 2005, trades: ["Impermeabilización"], r: [4.7, 4.5, 4.6, 4.6], jobs: 41,
    certs: [{ id: "rea", st: "ok", exp: "2028-03" }, { id: "iso9001", st: "ok", exp: "2027-09" }, { id: "iso14001", st: "ok", exp: "2027-09" }],
    reviews: [{ by: "Grupo Levante Promociones", obra: "Residencial Los Almendros F1", month: "2026-07", r: [5, 4.5, 4.5, 4.5], text: "Pruebas de estanqueidad impecables. Repetiremos." }],
  },
  {
    key: "k", name: "Cubiertas Camp de Túria", city: "Llíria", province: "Valencia", since: 2012, trades: ["Impermeabilización"], r: [4.0, 4.2, 3.9, 4.1], jobs: 19,
    certs: [{ id: "rea", st: "ok", exp: "2027-12" }, { id: "iso9001", st: "pending", exp: "2029-10" }],
    reviews: [{ by: "Vía Promociones", obra: "Naves Bétera", month: "2026-04", r: [4, 4, 4, 4], text: "Correctos en plazo y precio." }],
  },
  {
    key: "n", name: "Norte Impermeabilizaciones", city: "Castellón de la Plana", province: "Castellón", since: 2010, trades: ["Impermeabilización"], r: [4.3, 4.0, 4.2, 4.4], jobs: 26,
    certs: [{ id: "rea", st: "ok", exp: "2028-07" }, { id: "iso9001", st: "ok", exp: "2027-02" }],
    reviews: [{ by: "Constructora Ríos", obra: "Edificio Grao", month: "2025-12", r: [4.5, 4, 4, 4.5], text: "Buen trato y solución técnica cuidada." }],
  },
];

/** Industriales generados para que las partidas de otros oficios tengan pujadores reales. */
export const GENERATED: { trade: string; certs: string[]; names: [string, string, string][] }[] = [
  {
    trade: "Carpintería", certs: ["rea", "ce", "iso9001"],
    names: [["Aluminios Mediterráneo S.L.", "Quart de Poblet", "Valencia"], ["Carpintería Metálica Turís", "Turís", "Valencia"], ["Ventanas Levante RPT S.L.", "Burjassot", "Valencia"], ["Alumisa Valencia S.L.", "Massanassa", "Valencia"]],
  },
  {
    trade: "Estructuras", certs: ["rea"],
    names: [["Estructuras Marina Baixa S.L.", "Benidorm", "Alicante"], ["Hormigones Vinalopó", "Elda", "Alicante"], ["Forjados del Segura S.L.", "Orihuela", "Alicante"], ["Construcciones Alacant Estructural", "Alicante", "Alicante"], ["Encofrados Costa Blanca", "Dénia", "Alicante"], ["Ferrallas y Estructuras Elx", "Elche", "Alicante"]],
  },
  {
    trade: "Climatización", certs: ["rea", "rite", "fgas"],
    names: [["Clima Ruzafa Instalaciones", "Valencia", "Valencia"], ["Aerotermia Horta Sud S.L.", "Catarroja", "Valencia"], ["Frigoclima Valencia", "Mislata", "Valencia"], ["Instalaciones Térmicas Safor", "Gandia", "Valencia"]],
  },
  {
    trade: "Pintura", certs: ["rea"],
    names: [["Pinturas Plana Baixa", "Vila-real", "Castellón"], ["Decoraciones Benicàssim", "Benicàssim", "Castellón"], ["Fachadas Castalia S.L.", "Castellón de la Plana", "Castellón"], ["Pintura Industrial Onda", "Onda", "Castellón"], ["Revestimientos Maestrat", "Vinaròs", "Castellón"], ["Pinturas Burriana S.L.", "Burriana", "Castellón"], ["Acabados Grao Castellón", "Castellón de la Plana", "Castellón"]],
  },
];

export interface SeedTender {
  number: number;
  owner: string;
  title: string;
  obra: string;
  loc: string;
  sector: string;
  status: "borrador" | "abierta" | "evaluacion" | "adjudicada";
  /** ISO absoluta, o días desde hoy (para que las abiertas sigan abiertas al restablecer la demo) */
  closes: string | { inDays: number } | null;
  ref: number | null;
  req: string[];
  /** [código, descripción, unidad, medición, precio base orientativo] */
  items: [string, string, string, number, number][];
  /** precios por industrial explícitos (claves de INDUSTRIALS) */
  bids?: { ind: string; p: number[] }[];
  /** o pujas generadas a partir de un oficio de GENERATED */
  generatedBids?: { trade: string; count: number };
  /** clave del industrial adjudicatario, o "lowest" */
  awarded?: string;
  minRating?: number;
}

export const TENDERS: SeedTender[] = [
  {
    number: 241, owner: "levante", title: "Fontanería y saneamiento", obra: "Residencial Los Almendros · 48 viviendas", loc: "Valencia", sector: "Fontanería",
    status: "evaluacion", closes: "2026-10-08T18:00:00+02:00", ref: 245000, req: ["rea", "fon"],
    items: [
      ["01", "Red de abastecimiento PEX-a por vivienda", "ud", 48, 2000],
      ["02", "Red de saneamiento PVC", "ml", 1240, 38],
      ["03", "Aparatos sanitarios, suministro y colocación", "ud", 192, 300],
      ["04", "Grupo de presión y aljibe", "ud", 1, 18500],
      ["05", "Bajantes pluviales", "ml", 380, 28],
    ],
    bids: [
      { ind: "h", p: [2150, 38, 310, 18400, 29] },
      { ind: "f", p: [1980, 41, 295, 21000, 27] },
      { ind: "s", p: [2240, 36.5, 325, 17900, 31] },
      { ind: "a", p: [1890, 34, 280, 16500, 25] },
      { ind: "c", p: [2050, 39, 300, 19800, 28] },
    ],
  },
  {
    number: 238, owner: "levante", title: "Carpintería exterior de aluminio", obra: "Edificio Turia 12", loc: "Valencia", sector: "Carpintería",
    status: "abierta", closes: { inDays: 2 }, ref: null, req: ["rea", "ce", "iso9001"],
    items: [
      ["01", "Ventana practicable RPT 120×140", "ud", 86, 620],
      ["02", "Balconera corredera 240×220", "ud", 34, 1450],
      ["03", "Barandilla de vidrio laminado", "ml", 210, 185],
    ],
    generatedBids: { trade: "Carpintería", count: 4 },
  },
  {
    number: 233, owner: "levante", title: "Impermeabilización de cubiertas", obra: "Nave logística Ribarroja", loc: "Riba-roja de Túria", sector: "Impermeabilización",
    status: "adjudicada", closes: "2026-09-22T18:00:00+02:00", ref: 250000, req: ["rea"],
    items: [
      ["01", "Lámina EPDM 1,5 mm", "m²", 4200, 30],
      ["02", "Aislamiento XPS 80 mm", "m²", 4200, 19],
      ["03", "Remates de chapa en petos", "ml", 860, 42],
    ],
    bids: [
      { ind: "i", p: [31, 19, 42] },
      { ind: "k", p: [29, 21, 38] },
      { ind: "n", p: [33, 18.5, 45] },
    ],
    awarded: "i",
  },
  {
    number: 229, owner: "levante", title: "Instalación eléctrica de baja tensión", obra: "Residencial Los Almendros · 48 viviendas", loc: "Valencia", sector: "Electricidad",
    status: "borrador", closes: null, ref: null, req: ["rea", "ibt"],
    items: [
      ["01", "Instalación eléctrica interior por vivienda", "ud", 48, 0],
      ["02", "Centralización de contadores", "ud", 2, 0],
    ],
  },
  {
    number: 239, owner: "via", title: "Fontanería y saneamiento", obra: "Residencial Altea Hills · 32 viviendas", loc: "Altea, Alicante", sector: "Fontanería",
    status: "abierta", closes: { inDays: 5 }, ref: null, req: ["rea", "fon"], minRating: 4,
    items: [
      ["01", "Red de abastecimiento multicapa por vivienda", "ud", 32, 1850],
      ["02", "Red de saneamiento colgada de PVC", "ml", 860, 36],
      ["03", "Aparatos sanitarios de porcelana vitrificada", "ud", 128, 290],
      ["04", "Producción de ACS: termo eléctrico 100 l", "ud", 32, 420],
      ["05", "Arquetas de registro de fábrica", "ud", 14, 260],
      ["06", "Bajantes pluviales de PVC insonorizado", "ml", 240, 31],
    ],
    bids: [
      { ind: "f", p: [1790, 37, 285, 410, 255, 30] },
      { ind: "s", p: [1920, 34.5, 300, 435, 270, 29.5] },
    ],
  },
  {
    number: 236, owner: "rios", title: "Fontanería y saneamiento", obra: "Centro de salud Benicalap", loc: "Valencia", sector: "Fontanería",
    status: "abierta", closes: { inDays: 9 }, ref: null, req: ["rea", "fon", "iso45001"],
    items: [
      ["01", "Red de agua fría y caliente en polipropileno", "ml", 1650, 24],
      ["02", "Lavabos clínicos con grifería de codo", "ud", 46, 380],
      ["03", "Red de saneamiento en PVC", "ml", 720, 35],
    ],
    bids: [{ ind: "s", p: [23.5, 372, 34] }],
  },
  {
    number: 231, owner: "rios", title: "Fontanería y saneamiento", obra: "Edificio Patraix", loc: "Valencia", sector: "Fontanería",
    status: "adjudicada", closes: "2026-07-10T18:00:00+02:00", ref: 118000, req: ["rea", "fon"],
    items: [
      ["01", "Red de abastecimiento PEX-a por vivienda", "ud", 24, 2000],
      ["02", "Red de saneamiento PVC", "ml", 610, 37],
      ["03", "Aparatos sanitarios, suministro y colocación", "ud", 96, 300],
    ],
    bids: [
      { ind: "h", p: [2080, 36, 305] },
      { ind: "s", p: [2190, 35, 320] },
      { ind: "a", p: [1960, 39, 298] },
    ],
    awarded: "h",
  },
  {
    number: 240, owner: "via", title: "Estructura de hormigón armado", obra: "Residencial Altea Hills · 32 viviendas", loc: "Altea, Alicante", sector: "Estructuras",
    status: "abierta", closes: { inDays: 7 }, ref: 980000, req: ["rea"],
    items: [
      ["01", "Hormigón HA-30 en losa de cimentación", "m³", 820, 115],
      ["02", "Forjado reticular de canto 30 cm", "m²", 6400, 58],
      ["03", "Pilares de hormigón armado", "m³", 210, 420],
    ],
    generatedBids: { trade: "Estructuras", count: 6 },
  },
  {
    number: 237, owner: "rios", title: "Climatización por aerotermia", obra: "Edificio Patraix II", loc: "Valencia", sector: "Climatización",
    status: "evaluacion", closes: "2026-10-06T18:00:00+02:00", ref: 260000, req: ["rea", "rite", "fgas"],
    items: [
      ["01", "Equipo de aerotermia por vivienda", "ud", 36, 5200],
      ["02", "Red de conductos de climatización", "ml", 1450, 38],
      ["03", "Rejillas y difusores", "ud", 288, 46],
    ],
    generatedBids: { trade: "Climatización", count: 4 },
  },
  {
    number: 235, owner: "marazul", title: "Pintura de fachadas", obra: "Residencial Grao Castellón", loc: "Castellón de la Plana", sector: "Pintura",
    status: "adjudicada", closes: "2026-09-28T18:00:00+02:00", ref: 105000, req: ["rea"],
    items: [
      ["01", "Pintura pétrea en fachada", "m²", 5200, 11.5],
      ["02", "Andamio tubular homologado", "m²", 5200, 6],
      ["03", "Tratamiento de cantos de forjado", "ml", 900, 14],
    ],
    generatedBids: { trade: "Pintura", count: 7 },
    awarded: "lowest",
  },
];

/** Empresas pendientes de verificación (documentos subidos). */
export const PENDING = [
  { type: "industrial" as const, name: "Frío Industrial Safor S.L.", cif: "B98765432", province: "Valencia", email: "info@friosafor.es", date: "2026-10-10", docs: ["CIF", "REA", "Seguro RC"], trades: ["Climatización"] },
  { type: "promotora" as const, kind: "Constructora", name: "Construcciones Ebro Norte", cif: "B50123987", province: "Zaragoza", email: "admin@ebronorte.es", date: "2026-10-10", docs: ["CIF", "Escrituras"] },
  { type: "industrial" as const, name: "Electro Safor S.L.", cif: "B46554321", province: "Valencia", email: "obras@electrosafor.es", date: "2026-10-09", docs: ["CIF", "Seguro RC"], trades: ["Electricidad"] },
  { type: "promotora" as const, kind: "Promotora", name: "Inmobiliaria Bahía Sur", cif: "A11223344", province: "Cádiz", email: "direccion@bahiasur.es", date: "2026-10-08", docs: ["CIF", "Poder notarial"] },
];

/** Valoraciones reportadas por el industrial: [industrial, promotora, obra, motivo] */
export const REPORTS: [string, string, string, string][] = [
  ["f", "Grupo Levante Promociones", "Nave Ribarroja", "El industrial alega que el retraso se debió a un cambio de proyecto solicitado por la promotora."],
  ["a", "Promociones Mar Azul", "Residencial Xàtiva", "El industrial indica que las fugas estaban en tramos ejecutados por otra empresa."],
];

export const FILLER_OBRAS = [
  "Residencial Benimaclet II", "Edificio Ruzafa 8", "Torre Turia", "Residencial Campanar", "Naves Paterna", "Edificio Malvarrosa",
  "Residencial Godella", "Viviendas Torrent Centro", "Edificio Cabanyal", "Residencial Alboraya", "Nave Quart de Poblet", "Edificio Benicalap",
];

export { exp };
