// Shared theme tokens used by both the map preview and the SVG export so the
// two cannot drift visually.

export type ThemeTokens = {
  primary: string;
  secondary: string;
  background: string;
  water: string;
  roads: string;
  parks: string;
  buildings: string;
  labels: string;
};

export type MapStyleId =
  | "positron"
  | "dark"
  | "liberty"
  | "bright"
  | "fiord";

export type MapStyleDef = {
  id: MapStyleId;
  label: string;
  styleUrl: string;
  attribution: string;
  tokens: ThemeTokens;
};

// All five styles are served by OpenFreeMap (MIT-licensed styles + ODbL data),
// free for commercial use without API keys. See LicensePage for sources.
const OFM_ATTRIBUTION =
  "© OpenFreeMap · © OpenMapTiles · © OpenStreetMap contributors";

export const MAP_STYLES: MapStyleDef[] = [
  {
    id: "positron",
    label: "Positron (light)",
    styleUrl: "https://tiles.openfreemap.org/styles/positron",
    attribution: OFM_ATTRIBUTION,
    tokens: {
      primary: "#0f766e",
      secondary: "#94a3b8",
      background: "#f5f5f3",
      water: "#aad3df",
      roads: "#ffffff",
      parks: "#d8f1c0",
      buildings: "#dddcd4",
      labels: "#333333",
    },
  },
  {
    id: "dark",
    label: "Dark (deep)",
    styleUrl: "https://tiles.openfreemap.org/styles/dark",
    attribution: OFM_ATTRIBUTION,
    tokens: {
      primary: "#6da6ff",
      secondary: "#475569",
      background: "#0c0c0c",
      water: "#1a1f2e",
      roads: "#2a2a2a",
      parks: "#102014",
      buildings: "#1a1a1d",
      labels: "#cccccc",
    },
  },
  {
    id: "liberty",
    label: "Liberty",
    styleUrl: "https://tiles.openfreemap.org/styles/liberty",
    attribution: OFM_ATTRIBUTION,
    tokens: {
      primary: "#3b82f6",
      secondary: "#6b7280",
      background: "#f8f4f0",
      water: "#a0c8e0",
      roads: "#ffffff",
      parks: "#c8e6a0",
      buildings: "#e4ddd3",
      labels: "#222222",
    },
  },
  {
    id: "bright",
    label: "Bright",
    styleUrl: "https://tiles.openfreemap.org/styles/bright",
    attribution: OFM_ATTRIBUTION,
    tokens: {
      primary: "#e63946",
      secondary: "#457b9d",
      background: "#f1faee",
      water: "#a8dadc",
      roads: "#ffffff",
      parks: "#b7e4c7",
      buildings: "#e3e1d9",
      labels: "#1d3557",
    },
  },
  {
    id: "fiord",
    label: "Dark (soft) — Fiord",
    styleUrl: "https://tiles.openfreemap.org/styles/fiord",
    attribution: OFM_ATTRIBUTION,
    tokens: {
      primary: "#8ab4f8",
      secondary: "#a3aec3",
      background: "#45516e",
      water: "#38435c",
      roads: "#5a6478",
      parks: "#4d5b6e",
      buildings: "#525d75",
      labels: "#e6e9ef",
    },
  },
];

export const DEFAULT_STYLE_ID: MapStyleId = "positron";

export function getStyleDef(id: MapStyleId): MapStyleDef {
  return MAP_STYLES.find((s) => s.id === id) ?? MAP_STYLES[0];
}

export function buildTokens(
  styleId: MapStyleId,
  primaryOverride?: string,
  roadsOverride?: string | null,
): ThemeTokens {
  const base = getStyleDef(styleId).tokens;
  return {
    ...base,
    primary: primaryOverride || base.primary,
    roads: roadsOverride || base.roads,
  };
}

// Keep ThemeName as a union for legacy compat (used in MapView to pick dark bg).
export type ThemeName = "light" | "dark";

// Derive whether a style is "dark" for UI purposes.
export function isDarkStyle(id: MapStyleId): boolean {
  return id === "dark" || id === "fiord";
}
