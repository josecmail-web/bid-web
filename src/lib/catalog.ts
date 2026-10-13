import type { CertId, Sector, TenderStatus } from "./types";

export const CATS = ["Calidad", "Plazos", "Limpieza", "Trato"] as const;

export const CERTS: Record<CertId, { code: string; name: string }> = {
  rea: { code: "REA", name: "Registro de Empresas Acreditadas" },
  iso9001: { code: "ISO 9001", name: "Gestión de la calidad" },
  iso14001: { code: "ISO 14001", name: "Gestión ambiental" },
  iso45001: { code: "ISO 45001", name: "Seguridad y salud en el trabajo" },
  ibt: { code: "IBT", name: "Instalador autorizado de baja tensión" },
  rite: { code: "RITE", name: "Empresa instaladora térmica" },
  fgas: { code: "F-GAS", name: "Manipulación de gases fluorados" },
  fon: { code: "IF", name: "Empresa instaladora de fontanería" },
  ce: { code: "CE", name: "Marcado CE de carpintería (EN 14351-1)" },
  sold: { code: "EN 1090", name: "Ejecución de estructuras de acero" },
};

export const CERT_IDS = Object.keys(CERTS) as CertId[];

/** Propuesta: debe validarla el cliente o un asesor legal. */
export const SECTOR_REQ: Partial<Record<Sector, CertId[]>> = {
  Electricidad: ["ibt"],
  Climatización: ["rite", "fgas"],
  Fontanería: ["fon"],
  Carpintería: ["ce"],
  Cerrajería: ["sold"],
};

export const EXTRA_CERTS: CertId[] = ["iso9001", "iso14001", "iso45001"];

export function reqFor(sector: string, extra: CertId[] = []): CertId[] {
  return ["rea", ...(SECTOR_REQ[sector as Sector] ?? []), ...extra];
}

export function unlockTxt(id: CertId): string {
  if (id === "rea") return "Requisito para todos los oficios";
  const secs = (Object.keys(SECTOR_REQ) as Sector[]).filter((k) => SECTOR_REQ[k]!.includes(id));
  return secs.length ? "Da acceso a " + secs.join(", ") : "Exigible por promotoras en cada paquete";
}

export const SECTORS: [Sector, string[]][] = [
  ["Movimiento de tierras", ["movimiento de tierras", "excavacion", "terraplen", "zanja", "relleno", "vaciado", "desbroce", "zahorra"]],
  ["Estructuras", ["estructura", "hormigon", "encofrado", "armadura", "forjado", "pilar", "zapata", "losa ", "acero corrugado", "cimentacion", "muro de contencion"]],
  ["Albañilería", ["albanil", "ladrillo", "fabrica de", "tabique", "enfoscado", "mortero", "bloque de", "recrecido"]],
  ["Impermeabilización", ["impermeab", "lamina", "epdm", "tela asfaltica", "cubierta"]],
  ["Fontanería", ["fontaner", "saneamiento", "bajante", "abastecimiento", "sanitario", "pex", "tuberia", "aljibe", "grupo de presion", "arqueta", "desague", "inodoro", "lavabo", "plato de ducha", "pvc"]],
  ["Electricidad", ["electric", "cableado", "cable ", "cuadro general", "cuadro de", "luminaria", "mecanismo", "contador", "toma de tierra", "baja tension", "iluminacion", "telecomunicac"]],
  ["Climatización", ["climatiz", "aerotermia", "conducto", "split", "ventilacion", "vrv", "fancoil", "extraccion", "calefaccion"]],
  ["Carpintería", ["carpinter", "ventana", "puerta", "balconera", "persiana", "armario"]],
  ["Cerrajería", ["cerrajer", "barandilla", "reja", "vallado", "pasamanos"]],
  ["Pladur", ["pladur", "placa de yeso", "yeso laminado", "falso techo", "trasdosado"]],
  ["Revestimientos", ["revestimiento", "solado", "alicatado", "gres", "pavimento", "azulejo", "rodapie", "porcelanico", "tarima"]],
  ["Pintura", ["pintura", "esmalte", "barniz"]],
];

export const SECTOR_NAMES = SECTORS.map((s) => s[0]);

export const TITLE: Record<Sector, string> = {
  "Movimiento de tierras": "Movimiento de tierras",
  Estructuras: "Estructura de hormigón",
  Albañilería: "Albañilería y fábricas",
  Impermeabilización: "Impermeabilización de cubiertas",
  Fontanería: "Fontanería y saneamiento",
  Electricidad: "Instalación eléctrica",
  Climatización: "Climatización y ACS",
  Carpintería: "Carpintería exterior e interior",
  Cerrajería: "Cerrajería y barandillas",
  Pladur: "Tabiquería de placa de yeso",
  Revestimientos: "Solados y alicatados",
  Pintura: "Pintura",
};

export const TRADES: Sector[] = [
  "Albañilería",
  "Carpintería",
  "Cerrajería",
  "Climatización",
  "Electricidad",
  "Estructuras",
  "Fontanería",
  "Impermeabilización",
  "Pintura",
  "Pladur",
];

export const PROVINCES = ["Valencia", "Alicante", "Castellón", "Madrid", "Barcelona", "Murcia", "Zaragoza", "Sevilla"];

export const UNITS = ["ud", "m²", "ml", "m³", "kg", "PA"];

export const STATUS: Record<TenderStatus, [string, string]> = {
  abierta: ["Abierta", "tag tag-accent"],
  evaluacion: ["En evaluación", "tag tag-outline"],
  adjudicada: ["Adjudicada", "tag tag-neutral"],
  borrador: ["Borrador", "tag tag-neutral"],
};

export const SAMPLE: (string | number)[][] = [
  ["Código", "Descripción", "Ud", "Medición"],
  ["01", "MOVIMIENTO DE TIERRAS", "", ""],
  ["01.01", "Excavación de vaciado a máquina en terreno compacto", "m³", 3250],
  ["01.02", "Relleno y compactación de zanjas con zahorra", "m³", 410],
  ["02", "ESTRUCTURA", "", ""],
  ["02.01", "Hormigón HA-30 en losa de cimentación", "m³", 690],
  ["02.02", "Forjado reticular de canto 30 cm", "m²", 5400],
  ["03", "INSTALACIONES", "", ""],
  ["03.01", "Red de abastecimiento PEX-a por vivienda", "ud", 48],
  ["03.02", "Red de saneamiento enterrada de PVC", "ml", 1240],
  ["03.03", "Cuadro general de mando y protección por vivienda", "ud", 48],
  ["03.04", "Luminarias LED estancas en garaje y zonas comunes", "ud", 136],
  ["03.05", "Instalación de aerotermia para ACS y climatización", "ud", 48],
  ["04", "CERRAMIENTOS Y ACABADOS", "", ""],
  ["04.01", "Impermeabilización de cubierta con lámina EPDM", "m²", 1350],
  ["04.02", "Ventana practicable de aluminio con RPT", "ud", 210],
  ["04.03", "Trasdosado y tabiquería de placa de yeso laminado", "m²", 6200],
  ["04.04", "Solado de gres porcelánico 60×60", "m²", 4100],
  ["04.05", "Pintura plástica lisa en paramentos", "m²", 15800],
  ["04.06", "Barandilla de vidrio laminado en terrazas", "ml", 320],
  ["04.07", "Ayudas a oficios y limpieza final de obra", "PA", 1],
];
