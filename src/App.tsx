import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import {
  Copy,
  Download,
  History,
  ImageDown,
  LayoutGrid,
  MapPinned,
  Moon,
  Palette,
  Search,
  ShieldCheck,
  Sun,
  Trash2,
  type LucideIcon,
} from "lucide-react";
import { LicensePage } from "./LicensePage";
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
import { downloadBlob, downloadSvg, generateProjectedSvg } from "./svg";
import { buildTokens, DEFAULT_STYLE_ID, getStyleDef, MAP_STYLES, type MapStyleId } from "./theme";
import type { BBox, LayerKind } from "./types";
import type { ProjectedFeatureSet } from "./svg";

type UiTheme = "light" | "dark";

function getInitialTheme(): UiTheme {
  if (typeof document === "undefined") return "light";
  return (document.documentElement.getAttribute("data-theme") as UiTheme) ?? "light";
}

export function App() {
  const mapRef = useRef<MapHandle>(null);

  const [route, setRoute] = useState<"app" | "license">(
    typeof window !== "undefined" && window.location.hash === "#license" ? "license" : "app",
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
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [statusError, setStatusError] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  useEffect(() => {
    const onHash = () => {
      setRoute(window.location.hash === "#license" ? "license" : "app");
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
        setStatusMsg("No results");
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
      setStatusMsg("Invalid coordinates. Use: lat, lon");
      setStatusError(true);
      return;
    }
    setStatusMsg(null);
    setRecents((curr) =>
      pushRecent(curr, {
        label: "Coordinates",
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
      setStatusMsg(err instanceof Error ? err.message : "Copy failed");
      setStatusError(true);
    }
  }

  function handleExportSvgLocal() {
    const map = mapRef.current;
    if (!bbox) {
      setStatusMsg("Select an area first to export the local experimental SVG");
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
      const svg = generateProjectedSvg(filteredVisible, tokens);
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
      setStatusMsg("Select an area first to export PNG");
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
          <button
            type="button"
            className={"rail-item" + (route === "app" && panelTab === "workspace" ? " rail-item-active" : "")}
            onClick={() => {
              setRoute("app");
              setPanelTab("workspace");
              window.location.hash = "";
            }}
          >
            <LayoutGrid size={18} strokeWidth={1.9} />
            <span>Workspace</span>
          </button>
          <button
            type="button"
            className={"rail-item" + (route === "app" && panelTab === "history" ? " rail-item-active" : "")}
            onClick={() => {
              setRoute("app");
              setPanelTab("history");
              window.location.hash = "";
            }}
          >
            <History size={18} strokeWidth={1.9} />
            <span>History</span>
          </button>
          <button
            type="button"
            className={"rail-item" + (route === "license" ? " rail-item-active" : "")}
            onClick={() => {
              window.location.hash = "license";
              setRoute("license");
            }}
          >
            <ShieldCheck size={18} strokeWidth={1.9} />
            <span>Licensing</span>
          </button>
        </div>

        <div className="nav-rail-bottom">
          <button
            type="button"
            className="rail-item rail-item-settings"
            onClick={() => setUiTheme((t) => (t === "dark" ? "light" : "dark"))}
          >
            {uiTheme === "dark" ? <Sun size={16} strokeWidth={1.9} /> : <Moon size={16} strokeWidth={1.9} />}
            <span>{uiTheme === "dark" ? "Light mode" : "Dark mode"}</span>
          </button>
        </div>
      </aside>

      {route === "app" && <aside className="panel">
        <div className="panel-header">
          <div>
            <h1 className="panel-title">
              {panelTab === "workspace" ? "Workspace" : "History"}
            </h1>
            <div className="panel-subtitle">
              {panelTab === "workspace"
                ? "Search, select, export a vector area"
                : `${recents.length} recent ${recents.length === 1 ? "location" : "locations"}`}
            </div>
          </div>
        </div>
        <div className="panel-main">
          <div className="panel-body">
            {panelTab === "workspace" && <>
              <PanelSection title="Location" icon={Search}>
                  <form className="stack-sm" onSubmit={runNameSearch}>
                    <TextFieldAction
                      label="Search by name"
                      placeholder="Brooklyn Bridge, Lisbon"
                      value={nameQuery}
                      onChange={setNameQuery}
                      actionLabel="Find"
                      busy={searching}
                    />
                    {searchResults.length > 0 && (
                      <div className="results">
                        {searchResults.map((r, i) => (
                          <button
                            key={i}
                            className="result"
                            type="button"
                            onClick={() => applyResult(r)}
                          >
                            {r.display_name}
                          </button>
                        ))}
                      </div>
                    )}
                  </form>

                  <form className="stack-sm" onSubmit={runCoordSearch}>
                    <TextFieldAction
                      label="Coordinates"
                      placeholder="40.7128, -74.0060"
                      value={coordQuery}
                      onChange={setCoordQuery}
                      actionLabel="Go"
                    />
                  </form>
                </PanelSection>

                <PanelSection
                  title="Selection"
                  icon={MapPinned}
                  action={bbox ? <span className="selection-pulse">Active</span> : undefined}
                >
                  {!bbox && (
                    <div className="empty-state">
                      <div>
                        Hold <span className="kbd">Shift</span> and drag on the map
                      </div>
                      <div style={{ fontSize: 11, color: "var(--text-soft)" }}>
                        to draw a rectangular area
                      </div>
                    </div>
                  )}
                  {bbox && (
                    <>
                      <dl className="kv">
                        <dt>Center</dt>
                        <dd>
                          {((bbox.north + bbox.south) / 2).toFixed(5)},{" "}
                          {((bbox.east + bbox.west) / 2).toFixed(5)}
                        </dd>
                        <dt>SW</dt>
                        <dd>{bbox.south.toFixed(5)}, {bbox.west.toFixed(5)}</dd>
                        <dt>NE</dt>
                        <dd>{bbox.north.toFixed(5)}, {bbox.east.toFixed(5)}</dd>
                        {dimsKm && (
                          <>
                            <dt>Size</dt>
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
                          Clear selection
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
                          {copiedKey === "current-selection" ? "Copied" : "Copy location"}
                        </button>
                      </div>
                    </>
                  )}
                </PanelSection>

                <PanelSection title="Style" icon={Palette}>
                  <select
                    className="select"
                    value={styleId}
                    onChange={(e) => setStyleId(e.target.value as MapStyleId)}
                    aria-label="Map style"
                  >
                    {MAP_STYLES.map((s) => (
                      <option key={s.id} value={s.id}>{s.label}</option>
                    ))}
                  </select>
                  <SwitchRow
                    label="Hide labels"
                    checked={hideLabels}
                    onChange={setHideLabels}
                  />
                  <SwitchRow
                    label="Hide buildings"
                    checked={hideBuildings}
                    onChange={setHideBuildings}
                  />
                  <div className="roads-color-row">
                    <label htmlFor="roads-color-input" className="roads-color-label">
                      Roads color
                    </label>
                    <input
                      id="roads-color-input"
                      type="color"
                      className="roads-color-input"
                      value={effectiveRoadsColor}
                      onChange={(e) => setRoadsColor(e.target.value)}
                      aria-label="Pick roads color"
                    />
                    {roadsColor && (
                      <button
                        type="button"
                        className="roads-color-reset"
                        onClick={() => setRoadsColor(null)}
                      >
                        Reset
                      </button>
                    )}
                  </div>
                </PanelSection>
            </>}

            {panelTab === "history" && (
              <PanelSection
                title="History"
                icon={History}
                action={
                  <button
                    type="button"
                    className="section-action"
                    onClick={handleClearRecents}
                    aria-label="Clear location history"
                  >
                    <Trash2 size={13} strokeWidth={2} />
                  </button>
                }
              >
                {recents.length > 0 ? (
                  <div className="recents">
                    {recents.map((r, i) => (
                      <div key={i} className="recent-card">
                        <button
                          type="button"
                          className="recent-item"
                          onClick={() => applyRecent(r)}
                          title={r.label}
                        >
                          <span className="recent-label">{r.label}</span>
                          <span className="recent-meta">
                            {r.kind === "search" ? "Search" : r.kind === "coordinates" ? "Coordinates" : "Selection"}
                          </span>
                          <span className="recent-coords">{formatCoords(r.lat, r.lon)}</span>
                        </button>
                        <button
                          type="button"
                          className={"mini-action" + (copiedKey === `recent-${i}` ? " copied" : "")}
                          onClick={() => copyLocation(`recent-${i}`, formatRecentCopyText(r))}
                        >
                          <Copy size={13} strokeWidth={2} />
                          {copiedKey === `recent-${i}` ? "Copied" : "Copy"}
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="empty-state">
                    <div>No history yet</div>
                    <div style={{ fontSize: 11, color: "var(--text-soft)" }}>
                      searches and selections will appear here
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
              <span className="export-title">Export</span>
              <span className={"export-state" + (bbox ? " export-state-ready" : "")}>
                {bbox ? "Area selected" : "Select area"}
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
                  Exporting...
                </>
              ) : (
                <>
                  <Download size={15} strokeWidth={2} />
                  Local SVG
                </>
              )}
            </button>
            <div className="export-format-row">
              {([1, 2, 3] as const).map((scale) => (
                <button
                  key={scale}
                  className="btn export-chip"
                  type="button"
                  onClick={() => handleExportPng(scale)}
                  disabled={exporting || !bbox}
                >
                  {scale === 1 && <ImageDown size={13} strokeWidth={2} />}
                  {scale === 1 ? "PNG 1x" : `${scale}x`}
                </button>
              ))}
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
              Map data ©{" "}
              <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">
                OpenStreetMap
              </a>{" "}
              contributors (ODbL). {styleDef.attribution}.
            </div>
          </footer>
        </div>
      </aside>}

      {route === "app" ? (
        <MapView
          ref={mapRef}
          styleId={styleId}
          hideLabels={hideLabels}
          hideBuildings={hideBuildings}
          roadsColor={roadsColor}
          onSelect={setBbox}
        />
      ) : (
        <div className="license-shell">
          <LicensePage
            embedded
            uiTheme={uiTheme}
            onToggleTheme={() => setUiTheme((t) => (t === "dark" ? "light" : "dark"))}
            onBack={() => {
              window.location.hash = "";
              setRoute("app");
            }}
          />
        </div>
      )}
    </div>
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
    <section className="section section-card">
      <div className="section-title">
        <span className="section-heading">
          <Icon size={14} strokeWidth={2} />
          {title}
        </span>
        {action}
      </div>
      {children}
    </section>
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
