// Single source of truth for Copenhagen bin categories (Københavns Kommune).
// Source: affald.kk.dk/affaldsordninger. Verify bin categories, co-location rules, and collection seasons annually or after any KK communications about waste sorting rule changes.
// Never hardcode category names or IDs elsewhere in the codebase — always import from here.

export const BIN_IDS = [
  "madaffald",
  "plast",
  "mad-og-drikkekartoner",
  "papir",
  "restaffald",
  "metal",
  "pap",
  "glas",
  "elektronik",
  "farligt-affald",
  "medicin",
  "stort-indbo",
  "haveaffald",
  "batterier",
  "tekstilaffald",
  "indendoers-trae",
] as const;

export type BinId = (typeof BIN_IDS)[number];

export type BinCategory = {
  id: BinId;
  nameEn: string;
  nameDa: string;
  /** Hex color used to represent this category in the UI. Loosely based on physical bin color where applicable. */
  color: string;
  /** Icon token for the UI icon component. Intended for Ionicons — requires @expo/vector-icons to be installed. */
  icon: string;
  /** Free-text note, e.g. co-location rules */
  note?: string;
};

export const BINS: BinCategory[] = [
  {
    id: "madaffald",
    nameEn: "Food Waste",
    nameDa: "Madaffald",
    color: "#2E7D32", // dark green
    icon: "leaf",
    note: "Must be sorted in the supplied green bio bags.",
  },
  {
    id: "plast",
    nameEn: "Plastic",
    nameDa: "Plast",
    color: "#F9A825", // amber/yellow
    icon: "cube-outline",
    note: "Shares bin with food and drink cartons (mad- og drikkekartoner).",
  },
  {
    id: "mad-og-drikkekartoner",
    nameEn: "Food & Drink Cartons",
    nameDa: "Mad- og drikkekartoner",
    color: "#F9A825", // same amber — shares physical bin with plastic
    icon: "journal-outline",
    note: "Sorted together with plastic in the same bin.",
  },
  {
    id: "papir",
    nameEn: "Paper",
    nameDa: "Papir",
    color: "#1565C0", // blue
    icon: "document-text-outline",
  },
  {
    id: "restaffald",
    nameEn: "Residual Waste",
    nameDa: "Restaffald",
    color: "#424242", // dark grey
    icon: "trash-outline",
    note: "Only for waste that cannot be sorted elsewhere.",
  },
  {
    id: "metal",
    nameEn: "Metal",
    nameDa: "Metal",
    color: "#78909C", // blue-grey / steel
    icon: "hardware-chip-outline",
  },
  {
    id: "pap",
    nameEn: "Cardboard",
    nameDa: "Pap",
    color: "#8D6E63", // brown
    icon: "archive-outline",
  },
  {
    id: "glas",
    nameEn: "Glass",
    nameDa: "Glas",
    color: "#43A047", // medium green
    icon: "wine-outline",
  },
  {
    id: "elektronik",
    nameEn: "Electronics",
    nameDa: "Elektronik",
    color: "#283593", // dark blue
    icon: "phone-portrait-outline",
    note: "Anything with a cable, battery, or solar cell.",
  },
  {
    id: "farligt-affald",
    nameEn: "Hazardous Waste",
    nameDa: "Farligt affald",
    color: "#C62828", // red
    icon: "warning-outline",
    note: "Apartment residents: miljøskab code 4444 (verify with your housing association — may vary).",
  },
  {
    id: "medicin",
    nameEn: "Medicine",
    nameDa: "Medicin",
    color: "#00838F", // teal
    icon: "medkit-outline",
    note: "Must be handed to staff at a pharmacy — not left in bins.",
  },
  {
    id: "stort-indbo",
    nameEn: "Large Household Items",
    nameDa: "Stort indbo",
    color: "#6D4C41", // dark brown
    icon: "bed-outline",
    note: "Max 10 m³ per collection. Items max 2 m long.",
  },
  {
    id: "haveaffald",
    nameEn: "Garden Waste",
    nameDa: "Haveaffald",
    color: "#558B2F", // olive green
    icon: "flower-outline",
    note: "Collection season: 1 March – 30 November.",
  },
  {
    id: "batterier",
    nameEn: "Batteries",
    nameDa: "Batterier",
    color: "#F57F17", // orange-yellow
    icon: "battery-charging-outline",
    note: "Large batteries (>500 g) go to a recycling station.",
  },
  {
    id: "tekstilaffald",
    nameEn: "Textile Waste",
    nameDa: "Tekstilaffald",
    color: "#6A1B9A", // purple
    icon: "shirt-outline",
    note: "Must be washed, dry, and bagged with a knot.",
  },
  {
    id: "indendoers-trae",
    nameEn: "Indoor Wood",
    nameDa: "Indendørs træ",
    color: "#A1887F", // light brown
    icon: "construct-outline",
    note: "No impregnated wood. Max 2 m height. Keep nails hammered in.",
  },
];

// Guard: catch duplicate ids at module load time (e.g. from copy-paste errors)
const _seenIds = new Set<string>();
for (const bin of BINS) {
  if (_seenIds.has(bin.id)) throw new Error(`Duplicate BinCategory id: "${bin.id}"`);
  _seenIds.add(bin.id);
}

/** Convenience map for O(1) lookup by id */
export const BINS_BY_ID: Record<string, BinCategory | undefined> = Object.fromEntries(
  BINS.map((bin) => [bin.id, bin])
);
