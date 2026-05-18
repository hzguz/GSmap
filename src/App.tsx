import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useLocale } from "./i18n";
import {
  Copy,
  Download,
  FileText,
  History,
  ImageDown,
  LayoutGrid,
  MapPinned,
  Palette,
  Search,
  Settings,
  ShieldCheck,
  Trash2,
  type LucideIcon,
} from "lucide-react";
import { LicensePage } from "./LicensePage";
import { PrivacyPage } from "./PrivacyPage";
import { Logo } from "./Logo";
import { MapView, type MapHandle } from "./MapView";
import { searchPlace, parseCoordinates, type SearchResult } from "./nominatim";
import {
  centerOfBbox,
  clearRecents,
  formatCoords,
  formatRecentCopyText,
  loadRecents,
  pushRecent,
  type RecentLocation,
} from "./recents";
import { SettingsModal } from "./SettingsModal";
import { StyleSelect } from "./StyleSelect";
import { downloadBlob, downloadSvg, generateProjectedSvg } from "./svg";
import { buildTokens, DEFAULT_STYLE_ID, getStyleDef, type MapStyleId } from "./theme";
import type { BBox, LayerKind } from "./types";
import type { ProjectedFeatureSet } from "./svg";

type UiTheme = "light" | "dark";

function getInitialTheme(): UiTheme {
  if (typeof document === "undefined") return "light";
  return (document.documentElement.getAttribute("data-theme") as UiTheme) ?? "light";
}

export function App() {
  const { t } = useLocale();
  const mapRef = useRef<MapHandle>(null);

  const [route, setRoute] = useState<"app" | "license" | "privacy">(
    typeof window !== "undefined"
      ? window.location.hash === "#license" ? "license"
        : window.location.hash === "#privacy" ? "privacy"
        : "app"
      : "app",
  );
  const [uiTheme, setUiTheme] = useState<UiTheme>(getInitialTheme);
  const [panelTab, setPanelTab] = useState<"workspace" | "history">("workspace");

  const [styleId, setStyleId] = useState<MapStyleId>(DEFAULT_STYLE_ID);
  const [hideLabels, setHideLabels] = useState(false);
  const [hideBuildings, setHideBuildings] = useState(false);
  const [roadsColor, setRoadsColor] = useState<string | null>(null);
  const styleDef = useMemo(() => getStyleDef(styleId), [styleId]);
  const [nameQuery, setNameQuery] = useState("");
  const [coordQuery, setCoordQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);

  const [bbox, setBbox] = useState<BBox | null>(null);
  const [pendingLabel, setPendingLabel] = useState<string | null>(null);
  const [pendingSearchCoords, setPendingSearchCoords] = useState<{ lat: number; lon: number } | null>(null);
  const [recents, setRecents] = useState<RecentLocation[]>(() => loadRecents());
  const [exporting, setExporting] = useState(false);
  const [pngScale, setPngScale] = useState<1 | 2 | 3>(1);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [statusError, setStatusError] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    const onHash = () => {
      const hash = window.location.hash;
      setRoute(hash === "#license" ? "license" : hash === "#privacy" ? "privacy" : "app");
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", uiTheme);
    try {
      localStorage.setItem("gsmap-theme", uiTheme);
    } catch {
      // ignore storage failures so the app keeps rendering
    }
  }, [uiTheme]);

  useEffect(() => {
    if (!bbox) return;
    const center = pendingSearchCoords ?? centerOfBbox(bbox);
    setRecents((curr) =>
      pushRecent(curr, {
        bbox,
        label: pendingLabel ?? formatCoords(center.lat, center.lon),
        lat: center.lat,
        lon: center.lon,
        kind: pendingLabel ? "search" : "selection",
      }),
    );
    setPendingLabel(null);
    setPendingSearchCoords(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bbox]);

  const tokens = useMemo(
    () => buildTokens(styleId, undefined, roadsColor),
    [styleId, roadsColor],
  );

  const effectiveRoadsColor = roadsColor ?? getStyleDef(styleId).tokens.roads;

  const dimsKm = useMemo(() => {
    if (!bbox) return null;
    const latMid = (bbox.north + bbox.south) / 2;
    const widthKm =
      ((bbox.east - bbox.west) * Math.PI * 6371 * Math.cos((latMid * Math.PI) / 180)) / 180;
    const heightKm = ((bbox.north - bbox.south) * Math.PI * 6371) / 180;
    return { widthKm, heightKm };
  }, [bbox]);

  async function runNameSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!nameQuery.trim()) return;
    setSearching(true);
    setStatusMsg(null);
    try {
      const results = await searchPlace(nameQuery.trim());
      setSearchResults(results);
      if (results.length === 0) {
        setStatusMsg(t.location.noResults);
        setStatusError(false);
      }
    } catch (err) {
      setStatusMsg(err instanceof Error ? err.message : String(err));
      setStatusError(true);
    } finally {
      setSearching(false);
    }
  }

  function applyResult(r: SearchResult) {
    const [south, north, west, east] = r.boundingbox;
    const b: BBox = { south, north, west, east };
    mapRef.current?.fitBbox(b);
    setPendingLabel(r.display_name);
    setPendingSearchCoords({ lat: r.lat, lon: r.lon });
    setBbox(b);
    setSearchResults([]);
  }

  function applyRecent(r: RecentLocation) {
    if (r.bbox) {
      mapRef.current?.fitBbox(r.bbox);
    } else {
      setRecents((curr) =>
        pushRecent(curr, {
          label: r.label,
          lat: r.lat,
          lon: r.lon,
          kind: r.kind,
        }),
      );
      mapRef.current?.flyTo(r.lon, r.lat, 15);
    }
    setPendingLabel(r.label);
    setPendingSearchCoords({ lat: r.lat, lon: r.lon });
    setBbox(r.bbox ?? null);
  }

  function handleClearRecents() {
    setRecents(clearRecents());
  }

  function handleClearSelection() {
    mapRef.current?.clearSelection();
    setBbox(null);
    setPendingLabel(null);
    setPendingSearchCoords(null);
    setStatusMsg(null);
    setStatusError(false);
  }

  function runCoordSearch(e: React.FormEvent) {
    e.preventDefault();
    const parsed = parseCoordinates(coordQuery);
    if (!parsed) {
      setStatusMsg(t.location.invalidCoords);
      setStatusError(true);
      return;
    }
    setStatusMsg(null);
    setRecents((curr) =>
      pushRecent(curr, {
        label: t.location.coordinates,
        lat: parsed.lat,
        lon: parsed.lon,
        kind: "coordinates",
      }),
    );
    mapRef.current?.flyTo(parsed.lon, parsed.lat, 15);
  }

  async function copyLocation(key: string, text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      window.setTimeout(() => {
        setCopiedKey((curr) => (curr === key ? null : curr));
      }, 1400);
    } catch (err) {
      setStatusMsg(err instanceof Error ? err.message : t.selection.copyFailed);
      setStatusError(true);
    }
  }

  function handleExportSvgLocal() {
    const map = mapRef.current;
    if (!bbox) {
      setStatusMsg(t.export.selectAreaFirst);
      setStatusError(true);
      return;
    }
    const visible = map?.getProjectedFeatureSetForBbox(bbox);
    if (!visible) return;
    setExporting(true);
    setStatusMsg(null);
    setStatusError(false);
    try {
      const filteredVisible = filterProjectedFeatureSetLayers(visible, hideBuildings ? ["buildings"] : []);
      const svg = generateProjectedSvg(filteredVisible, tokens, !hideLabels);
      const stamp = new Date().toISOString().replace(/[:.]/g, "-");
      downloadSvg(svg, `gsmap-local-${stamp}.svg`);
      setStatusMsg(null);
      setStatusError(false);
    } catch (err) {
      setStatusMsg(err instanceof Error ? err.message : String(err));
      setStatusError(true);
    } finally {
      setExporting(false);
    }
  }

  async function handleExportPng(scale: 1 | 2 | 3) {
    const map = mapRef.current;
    if (!map || !bbox) {
      setStatusMsg(t.export.selectAreaFirstPng);
      setStatusError(true);
      return;
    }
    setExporting(true);
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    try {
      const png = await map.captureSelectedPng(bbox, scale);
      downloadBlob(png, `gsmap-selection-${stamp}@${scale}x.png`);
      setStatusMsg(null);
      setStatusError(false);
    } catch (err) {
      setStatusMsg(err instanceof Error ? err.message : String(err));
      setStatusError(true);
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className={"app" + (route === "license" ? " app-license" : "")}>
      <aside className="nav-rail">
        <div className="nav-rail-top">
          <div className="nav-rail-brand">
            <Logo size={32} />
            <span className="brand-name">GSmap</span>
          </div>
          <RailItem
            active={route === "app" && panelTab === "workspace"}
            onClick={() => { setRoute("app"); setPanelTab("workspace"); window.location.hash = ""; }}
            icon={<LayoutGrid size={18} strokeWidth={1.9} />}
            label={t.nav.workspace}
          />
          <RailItem
            active={route === "app" && panelTab === "history"}
            onClick={() => { setRoute("app"); setPanelTab("history"); window.location.hash = ""; }}
            icon={<History size={18} strokeWidth={1.9} />}
            label={t.nav.history}
          />
          <RailItem
            active={route === "license"}
            onClick={() => { window.location.hash = "license"; setRoute("license"); }}
            icon={<ShieldCheck size={18} strokeWidth={1.9} />}
            label={t.nav.licensing}
          />
          <RailItem
            active={route === "privacy"}
            onClick={() => { window.location.hash = "privacy"; setRoute("privacy"); }}
            icon={<FileText size={18} strokeWidth={1.9} />}
            label={t.nav.privacy}
          />
        </div>

        <div className="nav-rail-bottom">
          <motion.button
            type="button"
            className="rail-item rail-item-settings"
            onClick={() => setSettingsOpen(true)}
            whileHover={{ y: -1 }}
            whileTap={{ y: 1 }}
            transition={{ duration: 0.12 }}
          >
            <Settings size={16} strokeWidth={1.9} />
            <span>{t.nav.settings}</span>
          </motion.button>
        </div>
      </aside>

      <SettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        uiTheme={uiTheme}
        onChangeTheme={setUiTheme}
      />

      {route === "app" && <aside className="panel">
        <div className="panel-header">
          <div>
            <h1 className="panel-title">
              {panelTab === "workspace" ? t.panel.workspace : t.panel.history}
            </h1>
            <div className="panel-subtitle">
              {panelTab === "workspace"
                ? t.panel.subtitleWorkspace
                : t.panel.subtitleHistory(recents.length)}
            </div>
          </div>
        </div>
        <div className="panel-main">
          <div className="panel-body">
            {panelTab === "workspace" && <>
              <PanelSection title={t.location.sectionTitle} icon={Search}>
                  <form className="stack-sm" onSubmit={runNameSearch}>
                    <TextFieldAction
                      label={t.location.searchByName}
                      placeholder={t.location.searchPlaceholder}
                      value={nameQuery}
                      onChange={setNameQuery}
                      actionLabel={t.location.findAction}
                      busy={searching}
                    />
                    <AnimatePresence>
                      {searchResults.length > 0 && (
                        <motion.div
                          className="results"
                          initial={{ opacity: 0, y: -4 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -4 }}
                          transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                        >
                          {searchResults.map((r, i) => (
                            <motion.button
                              key={i}
                              className="result"
                              type="button"
                              onClick={() => applyResult(r)}
                              initial={{ opacity: 0, x: -4 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: i * 0.025, duration: 0.16 }}
                            >
                              {r.display_name}
                            </motion.button>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </form>

                  <form className="stack-sm" onSubmit={runCoordSearch}>
                    <TextFieldAction
                      label={t.location.coordinates}
                      placeholder={t.location.coordPlaceholder}
                      value={coordQuery}
                      onChange={setCoordQuery}
                      actionLabel={t.location.goAction}
                    />
                  </form>
                </PanelSection>

                <PanelSection
                  title={t.selection.sectionTitle}
                  icon={MapPinned}
                  action={bbox ? <span className="selection-pulse">{t.selection.active}</span> : undefined}
                >
                  {!bbox && (
                    <div className="empty-state">
                      <div>
                        {t.selection.hint} <span className="kbd">{t.selection.hintKey}</span> {t.selection.hintSuffix}
                      </div>
                      <div style={{ fontSize: 11, color: "var(--text-soft)" }}>
                        {t.selection.hintDetail}
                      </div>
                    </div>
                  )}
                  {bbox && (
                    <>
                      <dl className="kv">
                        <dt>{t.selection.center}</dt>
                        <dd>
                          {((bbox.north + bbox.south) / 2).toFixed(5)},{" "}
                          {((bbox.east + bbox.west) / 2).toFixed(5)}
                        </dd>
                        <dt>{t.selection.sw}</dt>
                        <dd>{bbox.south.toFixed(5)}, {bbox.west.toFixed(5)}</dd>
                        <dt>{t.selection.ne}</dt>
                        <dd>{bbox.north.toFixed(5)}, {bbox.east.toFixed(5)}</dd>
                        {dimsKm && (
                          <>
                            <dt>{t.selection.size}</dt>
                            <dd>
                              {dimsKm.widthKm.toFixed(2)} x {dimsKm.heightKm.toFixed(2)} km
                            </dd>
                          </>
                        )}
                      </dl>
                      <div className="location-actions">
                        <button
                          type="button"
                          className="mini-action"
                          onClick={handleClearSelection}
                        >
                          <Trash2 size={13} strokeWidth={2} />
                          {t.selection.clearSelection}
                        </button>
                        <button
                          type="button"
                          className={"mini-action" + (copiedKey === "current-selection" ? " copied" : "")}
                          onClick={() =>
                            copyLocation(
                              "current-selection",
                              `Selected area - ${formatCoords(
                                (bbox.north + bbox.south) / 2,
                                (bbox.east + bbox.west) / 2,
                              )}`,
                            )
                          }
                        >
                          <Copy size={13} strokeWidth={2} />
                          {copiedKey === "current-selection" ? t.selection.copied : t.selection.copyLocation}
                        </button>
                      </div>
                    </>
                  )}
                </PanelSection>

                <PanelSection title={t.style.sectionTitle} icon={Palette}>
                  <StyleSelect
                    value={styleId}
                    onChange={setStyleId}
                    ariaLabel={t.style.mapStyle}
                  />
                  <SwitchRow
                    label={t.style.hideLabels}
                    checked={hideLabels}
                    onChange={setHideLabels}
                  />
                  <SwitchRow
                    label={t.style.hideBuildings}
                    checked={hideBuildings}
                    onChange={setHideBuildings}
                  />
                  <div className="roads-color-row">
                    <label htmlFor="roads-color-input" className="roads-color-label">
                      {t.style.roadsColor}
                    </label>
                    <input
                      id="roads-color-input"
                      type="color"
                      className="roads-color-input"
                      value={effectiveRoadsColor}
                      onChange={(e) => setRoadsColor(e.target.value)}
                      aria-label={t.style.roadsColor}
                    />
                    {roadsColor && (
                      <button
                        type="button"
                        className="roads-color-reset"
                        onClick={() => setRoadsColor(null)}
                      >
                        {t.style.reset}
                      </button>
                    )}
                  </div>
                </PanelSection>
            </>}

            {panelTab === "history" && (
              <PanelSection
                title={t.historySection.sectionTitle}
                icon={History}
                action={
                  <button
                    type="button"
                    className="section-action"
                    onClick={handleClearRecents}
                    aria-label={t.historySection.clearHistory}
                  >
                    <Trash2 size={13} strokeWidth={2} />
                  </button>
                }
              >
                {recents.length > 0 ? (
                  <motion.div
                    className="recents"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.18 }}
                  >
                    {recents.map((r, i) => (
                      <motion.div
                        key={i}
                        className="recent-card"
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.025, duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                      >
                        <button
                          type="button"
                          className="recent-item"
                          onClick={() => applyRecent(r)}
                          title={r.label}
                        >
                          <span className="recent-label">{r.label}</span>
                          <span className="recent-meta">
                            {r.kind === "search" ? t.historySection.kindSearch : r.kind === "coordinates" ? t.historySection.kindCoordinates : t.historySection.kindSelection}
                          </span>
                          <span className="recent-coords">{formatCoords(r.lat, r.lon)}</span>
                        </button>
                        <button
                          type="button"
                          className={"mini-action" + (copiedKey === `recent-${i}` ? " copied" : "")}
                          onClick={() => copyLocation(`recent-${i}`, formatRecentCopyText(r))}
                        >
                          <Copy size={13} strokeWidth={2} />
                          {copiedKey === `recent-${i}` ? t.historySection.copied : t.historySection.copy}
                        </button>
                      </motion.div>
                    ))}
                  </motion.div>
                ) : (
                  <div className="empty-state">
                    <div>{t.historySection.noHistory}</div>
                    <div style={{ fontSize: 11, color: "var(--text-soft)" }}>
                      {t.historySection.noHistoryDetail}
                    </div>
                  </div>
                )}
              </PanelSection>
            )}
          </div>
        </div>

        <div className="panel-bottom">
          <div className="export-dock">
            <div className="export-header">
              <span className="export-title">{t.export.sectionTitle}</span>
              <span className={"export-state" + (bbox ? " export-state-ready" : "")}>
                {bbox ? t.export.areaSelected : t.export.selectArea}
              </span>
            </div>
            <button
              className="btn btn-primary export-primary"
              type="button"
              onClick={handleExportSvgLocal}
              disabled={exporting || !bbox}
            >
              {exporting ? (
                <>
                  <span className="spinner" />
                  {t.export.exporting}
                </>
              ) : (
                <>
                  <Download size={15} strokeWidth={2} />
                  {t.export.localSvg}
                </>
              )}
            </button>
            <div className="export-png-row">
              <button
                className="btn export-chip export-png-btn"
                type="button"
                onClick={() => handleExportPng(pngScale)}
                disabled={exporting || !bbox}
              >
                <ImageDown size={13} strokeWidth={2} />
                {t.export.exportPng}
              </button>
              <select
                className="select export-png-scale"
                value={pngScale}
                onChange={(e) => setPngScale(Number(e.target.value) as 1 | 2 | 3)}
                disabled={exporting || !bbox}
                aria-label={t.export.pngAriaLabel}
              >
                <option value={1}>1x</option>
                <option value={2}>2x</option>
                <option value={3}>3x</option>
              </select>
            </div>
            {statusMsg && (
              <div
                className={"status export-status" + (statusError ? " status-error" : "")}
                role="status"
              >
                {exporting && !statusError && <span className="spinner" />}
                {statusMsg}
              </div>
            )}
          </div>

          <footer className="app-footer">
            <div>
              {t.footer.mapData}{" "}
              <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">
                OpenStreetMap
              </a>{" "}
              {t.footer.contributors} {styleDef.attribution}.
            </div>
          </footer>
        </div>
      </aside>}

      {route === "app" && (
        <MapView
          ref={mapRef}
          styleId={styleId}
          hideLabels={hideLabels}
          hideBuildings={hideBuildings}
          roadsColor={roadsColor}
          onSelect={setBbox}
        />
      )}
      <AnimatePresence mode="wait">
        {route === "license" && (
          <motion.div
            key="license"
            className="license-shell"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
          >
            <LicensePage
              embedded
              uiTheme={uiTheme}
              onToggleTheme={() => setUiTheme((t) => (t === "dark" ? "light" : "dark"))}
              onBack={() => { window.location.hash = ""; setRoute("app"); }}
            />
          </motion.div>
        )}
        {route === "privacy" && (
          <motion.div
            key="privacy"
            className="license-shell"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
          >
            <PrivacyPage
              embedded
              uiTheme={uiTheme}
              onToggleTheme={() => setUiTheme((t) => (t === "dark" ? "light" : "dark"))}
              onBack={() => { window.location.hash = ""; setRoute("app"); }}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

type RailItemProps = {
  active: boolean;
  onClick: () => void;
  icon: ReactNode;
  label: string;
};

function RailItem({ active, onClick, icon, label }: RailItemProps) {
  return (
    <motion.button
      type="button"
      className={"rail-item" + (active ? " rail-item-active" : "")}
      onClick={onClick}
      whileHover={{ y: -1 }}
      whileTap={{ y: 1 }}
      transition={{ duration: 0.12 }}
    >
      {icon}
      <span>{label}</span>
    </motion.button>
  );
}

type PanelSectionProps = {
  title: string;
  icon: LucideIcon;
  action?: ReactNode;
  children: ReactNode;
};

function PanelSection({ title, icon: Icon, action, children }: PanelSectionProps) {
  return (
    <motion.section
      className="section section-card"
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="section-title">
        <span className="section-heading">
          <Icon size={14} strokeWidth={2} />
          {title}
        </span>
        {action}
      </div>
      {children}
    </motion.section>
  );
}

type TextFieldActionProps = {
  label: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  actionLabel: string;
  busy?: boolean;
};

function TextFieldAction({
  label,
  placeholder,
  value,
  onChange,
  actionLabel,
  busy = false,
}: TextFieldActionProps) {
  return (
    <div className="field-group">
      <span className="field-label">{label}</span>
      <span className="field-action">
        <input
          className="input"
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
        <button className="btn field-action-button" type="submit" disabled={busy}>
          {busy ? <span className="spinner" /> : actionLabel}
        </button>
      </span>
    </div>
  );
}

type SwitchRowProps = {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
};

function SwitchRow({ label, checked, onChange }: SwitchRowProps) {
  return (
    <label className="switch-row">
      <span>{label}</span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="switch-track" aria-hidden="true">
        <span className="switch-thumb" />
      </span>
    </label>
  );
}

function filterProjectedFeatureSetLayers(
  set: ProjectedFeatureSet,
  hiddenLayers: LayerKind[],
): ProjectedFeatureSet {
  if (hiddenLayers.length === 0) return set;
  const hidden = new Set(hiddenLayers);
  return {
    ...set,
    features: set.features.filter((feature) => !hidden.has(feature.layer)),
  };
}
