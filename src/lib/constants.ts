import type { Rarity } from "../types";

// ─── Design Tokens ────────────────────────────────────────────
export const T = {
  bg:       "#0A0A0C",
  surface:  "#14141A",
  card:     "#18181F",
  border:   "#252530",
  accent:   "#E8430A",
  accentDk: "#BF360C",
  accentDm: "#2D1200",
  gold:     "#C9A84C",
  green:    "#22C55E",
  blue:     "#3B82F6",
  danger:   "#EF4444",
  text:     "#F2EEE8",
  sub:      "#AAA6A0",
  muted:    "#6B6878",
  faint:    "#3D3D4E",
} as const;

// ─── Rarity Config ────────────────────────────────────────────
export const RARITY_CONFIG: Record<Rarity, { bg: string; text: string; border: string }> = {
  Hypercar: { bg: "#1a0a2e", text: "#b388ff", border: "#6a0dad" },
  Exotic:   { bg: T.accentDm, text: T.accent, border: T.accent },
  Sports:   { bg: "#0a1a2e", text: "#60a5fa", border: "#60a5fa" },
};

// ─── Feed ─────────────────────────────────────────────────────
export const PAGE_SIZE = 10;
export const CACHE_TTL = 60_000; // 1 minute
export const AUTH_TIMEOUT = 10_000; // 10 seconds
export const ONBOARDING_KEY = "sd_onboarded_v1";

// ─── Car Makes & Models ───────────────────────────────────────
export const CAR_MAKES = [
  "Aston Martin", "Audi", "Bentley", "BMW", "Bugatti",
  "Chevrolet", "Ferrari", "Ford", "Koenigsegg", "Lamborghini",
  "Lotus", "Maserati", "McLaren", "Mercedes-Benz", "Nissan",
  "Pagani", "Porsche", "Rolls-Royce", "Tesla", "Toyota",
] as const;

export const CAR_MODELS: Partial<Record<string, string[]>> = {
  "Ferrari":       ["296 GTB", "488 Pista", "812 Superfast", "F8 Tributo", "LaFerrari", "Roma", "SF90 Stradale"],
  "Lamborghini":   ["Aventador SVJ", "Huracán STO", "Huracán Tecnica", "Reventón", "Sián", "Urus"],
  "Bugatti":       ["Chiron", "Chiron Super Sport", "Divo", "Mistral", "Veyron"],
  "McLaren":       ["600LT", "720S", "765LT", "Artura", "P1", "Senna"],
  "Porsche":       ["911 GT2 RS", "911 GT3", "911 GT3 RS", "918 Spyder", "Cayenne Turbo", "Taycan Turbo S"],
  "Aston Martin":  ["DB11", "DBS Superleggera", "DBX", "Valkyrie", "Vantage"],
  "Pagani":        ["Huayra", "Huayra BC", "Huayra R", "Zonda"],
  "Koenigsegg":    ["Agera RS", "CC850", "Gemera", "Jesko", "One:1", "Regera"],
  "Rolls-Royce":   ["Cullinan", "Dawn", "Ghost", "Phantom", "Spectre", "Wraith"],
  "Bentley":       ["Bentayga", "Continental GT", "Flying Spur", "Mulsanne"],
  "BMW":           ["M2", "M3 CSL", "M4 CSL", "M5 CS", "M8 Competition", "XM"],
  "Mercedes-Benz": ["AMG GT Black Series", "AMG ONE", "C63 AMG", "G63 AMG", "GLE 63", "SL 63"],
  "Nissan":        ["GT-R", "GT-R Nismo", "GT-R R34", "GT-R R35 Track Edition"],
  "Audi":          ["R8 V10", "R8 V10 Performance", "RS3", "RS6 Avant", "RS7", "TT RS"],
};
