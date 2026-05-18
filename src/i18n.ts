import { createContext, createElement, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type LocalePref = "auto" | "pt-BR" | "en";
export type ResolvedLocale = "pt-BR" | "en";

const STORAGE_KEY = "gsmap-locale";

const ptBR = {
  nav: {
    workspace: "Mapa",
    history: "Histórico",
    licensing: "Licenças",
    privacy: "Privacidade",
    lightMode: "Modo claro",
    darkMode: "Modo escuro",
    settings: "Configurações",
  },
  panel: {
    workspace: "Mapa",
    history: "Histórico",
    subtitleWorkspace: "Pesquise, selecione e exporte uma área vetorial",
    subtitleHistory: (count: number) =>
      `${count} ${count === 1 ? "local recente" : "locais recentes"}`,
  },
  location: {
    sectionTitle: "Localização",
    searchByName: "Pesquisar por nome",
    searchPlaceholder: "Ponte Brooklyn, Lisboa",
    findAction: "Buscar",
    coordinates: "Coordenadas",
    coordPlaceholder: "40.7128, -74.0060",
    goAction: "Ir",
    noResults: "Sem resultados",
    invalidCoords: "Coordenadas inválidas. Use: lat, lon",
  },
  selection: {
    sectionTitle: "Seleção",
    active: "Ativa",
    hint: "Segure",
    hintKey: "Shift",
    hintSuffix: "e arraste no mapa",
    hintDetail: "para desenhar uma área retangular",
    center: "Centro",
    sw: "SW",
    ne: "NE",
    size: "Tamanho",
    clearSelection: "Limpar seleção",
    copyLocation: "Copiar local",
    copied: "Copiado",
    copyFailed: "Falha ao copiar",
  },
  style: {
    sectionTitle: "Estilo",
    mapStyle: "Estilo do mapa",
    hideLabels: "Ocultar rótulos",
    hideBuildings: "Ocultar edifícios",
    roadsColor: "Cor das vias",
    reset: "Redefinir",
  },
  historySection: {
    sectionTitle: "Histórico",
    clearHistory: "Limpar histórico",
    kindSearch: "Pesquisa",
    kindCoordinates: "Coordenadas",
    kindSelection: "Seleção",
    noHistory: "Sem histórico ainda",
    noHistoryDetail: "pesquisas e seleções aparecerão aqui",
    copy: "Copiar",
    copied: "Copiado",
  },
  export: {
    sectionTitle: "Exportar",
    areaSelected: "Área selecionada",
    selectArea: "Selecionar área",
    localSvg: "SVG Local",
    exporting: "Exportando...",
    exportPng: "Exportar PNG",
    pngAriaLabel: "Escala do PNG",
    selectAreaFirst: "Selecione uma área antes de exportar o SVG",
    selectAreaFirstPng: "Selecione uma área antes de exportar o PNG",
  },
  footer: {
    mapData: "Dados do mapa ©",
    contributors: "colaboradores (ODbL).",
  },
  settings: {
    title: "Configurações",
    close: "Fechar",
    theme: "Tema",
    themeLight: "Claro",
    themeDark: "Escuro",
    language: "Idioma",
    languageAuto: "Automático",
    languageAutoHint: "Detecta do navegador",
  },
} as const;

const enUS = {
  nav: {
    workspace: "Map",
    history: "History",
    licensing: "Licensing",
    privacy: "Privacy",
    lightMode: "Light mode",
    darkMode: "Dark mode",
    settings: "Settings",
  },
  panel: {
    workspace: "Map",
    history: "History",
    subtitleWorkspace: "Search, select, export a vector area",
    subtitleHistory: (count: number) =>
      `${count} recent ${count === 1 ? "location" : "locations"}`,
  },
  location: {
    sectionTitle: "Location",
    searchByName: "Search by name",
    searchPlaceholder: "Brooklyn Bridge, Lisbon",
    findAction: "Find",
    coordinates: "Coordinates",
    coordPlaceholder: "40.7128, -74.0060",
    goAction: "Go",
    noResults: "No results",
    invalidCoords: "Invalid coordinates. Use: lat, lon",
  },
  selection: {
    sectionTitle: "Selection",
    active: "Active",
    hint: "Hold",
    hintKey: "Shift",
    hintSuffix: "and drag on the map",
    hintDetail: "to draw a rectangular area",
    center: "Center",
    sw: "SW",
    ne: "NE",
    size: "Size",
    clearSelection: "Clear selection",
    copyLocation: "Copy location",
    copied: "Copied",
    copyFailed: "Copy failed",
  },
  style: {
    sectionTitle: "Style",
    mapStyle: "Map style",
    hideLabels: "Hide labels",
    hideBuildings: "Hide buildings",
    roadsColor: "Roads color",
    reset: "Reset",
  },
  historySection: {
    sectionTitle: "History",
    clearHistory: "Clear location history",
    kindSearch: "Search",
    kindCoordinates: "Coordinates",
    kindSelection: "Selection",
    noHistory: "No history yet",
    noHistoryDetail: "searches and selections will appear here",
    copy: "Copy",
    copied: "Copied",
  },
  export: {
    sectionTitle: "Export",
    areaSelected: "Area selected",
    selectArea: "Select area",
    localSvg: "Local SVG",
    exporting: "Exporting...",
    exportPng: "Export PNG",
    pngAriaLabel: "PNG scale",
    selectAreaFirst: "Select an area first to export the local experimental SVG",
    selectAreaFirstPng: "Select an area first to export PNG",
  },
  footer: {
    mapData: "Map data ©",
    contributors: "contributors (ODbL).",
  },
  settings: {
    title: "Settings",
    close: "Close",
    theme: "Theme",
    themeLight: "Light",
    themeDark: "Dark",
    language: "Language",
    languageAuto: "Automatic",
    languageAutoHint: "Detect from browser",
  },
} as const;

export type Translations = typeof enUS;

function detectBrowserLocale(): ResolvedLocale {
  if (typeof navigator === "undefined") return "en";
  const lang = (navigator.language || "en").toLowerCase();
  return lang.startsWith("pt") ? "pt-BR" : "en";
}

function resolveLocale(pref: LocalePref): ResolvedLocale {
  return pref === "auto" ? detectBrowserLocale() : pref;
}

export function getTranslations(locale: ResolvedLocale): Translations {
  return locale === "pt-BR" ? (ptBR as unknown as Translations) : enUS;
}

function loadStoredPref(): LocalePref {
  if (typeof localStorage === "undefined") return "auto";
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "auto" || stored === "pt-BR" || stored === "en") return stored;
  } catch {
    // ignore
  }
  return "auto";
}

type LocaleContextValue = {
  pref: LocalePref;
  resolved: ResolvedLocale;
  t: Translations;
  setPref: (pref: LocalePref) => void;
};

const LocaleContext = createContext<LocaleContextValue | null>(null);

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [pref, setPrefState] = useState<LocalePref>(() => loadStoredPref());

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, pref);
    } catch {
      // ignore
    }
  }, [pref]);

  const value = useMemo<LocaleContextValue>(() => {
    const resolved = resolveLocale(pref);
    return {
      pref,
      resolved,
      t: getTranslations(resolved),
      setPref: setPrefState,
    };
  }, [pref]);

  return createElement(LocaleContext.Provider, { value }, children);
}

export function useLocale(): LocaleContextValue {
  const ctx = useContext(LocaleContext);
  if (!ctx) throw new Error("useLocale must be used within LocaleProvider");
  return ctx;
}
