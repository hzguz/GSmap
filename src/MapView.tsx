import { useEffect, useImperativeHandle, useRef, forwardRef } from "react";
import maplibregl, { Map as MlMap, LngLatBoundsLike } from "maplibre-gl";
import type { BBox, Geometry, LayerKind, LngLat } from "./types";
import { getStyleDef, type MapStyleId } from "./theme";
import type { ProjectedFeatureSet } from "./svg";

export type MapHandle = {
  flyTo: (lng: number, lat: number, zoom?: number) => void;
  fitBbox: (bbox: BBox) => void;
  clearSelection: () => void;
  getProjectedFeatureSetForBbox: (bbox: BBox) => ProjectedFeatureSet | null;
  captureSelectedPng: (bbox: BBox, scale: 1 | 2 | 3) => Promise<Blob>;
};

type Props = {
  styleId: MapStyleId;
  hideLabels: boolean;
  hideBuildings: boolean;
  roadsColor: string | null;
  onSelect: (bbox: BBox | null) => void;
};

export const MapView = forwardRef<MapHandle, Props>(function MapView(
  { styleId, hideLabels, hideBuildings, roadsColor, onSelect },
  ref,
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MlMap | null>(null);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const hideLabelsRef = useRef(hideLabels);
  hideLabelsRef.current = hideLabels;
  const hideBuildingsRef = useRef(hideBuildings);
  hideBuildingsRef.current = hideBuildings;
  const roadsColorRef = useRef(roadsColor);
  roadsColorRef.current = roadsColor;

  const selectingRef = useRef(false);
  const startPxRef = useRef<{ x: number; y: number } | null>(null);
  const boxElRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const def = getStyleDef(styleId);
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: def.styleUrl,
      center: [-46.6388, -23.5489],
      zoom: 13,
      preserveDrawingBuffer: true,
      attributionControl: { compact: true },
    });
    map.addControl(new maplibregl.NavigationControl({ visualizePitch: false }), "top-right");
    mapRef.current = map;

    const canvas = map.getCanvasContainer();

    const onMouseDown = (e: MouseEvent) => {
      if (!e.shiftKey) return;
      e.preventDefault();
      e.stopPropagation();
      map.dragPan.disable();
      selectingRef.current = true;
      const rect = canvas.getBoundingClientRect();
      startPxRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };

      const box = document.createElement("div");
      const accent =
        getComputedStyle(document.documentElement).getPropertyValue("--accent").trim() ||
        "#0f766e";
      box.style.cssText =
        `position:absolute;border:2px dashed ${accent};background:${accent}1f;pointer-events:none;z-index:10;border-radius:4px;`;
      canvas.appendChild(box);
      boxElRef.current = box;

      window.addEventListener("mousemove", onMouseMove);
      window.addEventListener("mouseup", onMouseUp);
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!selectingRef.current || !startPxRef.current || !boxElRef.current) return;
      const rect = canvas.getBoundingClientRect();
      const cur = { x: e.clientX - rect.left, y: e.clientY - rect.top };
      const x = Math.min(cur.x, startPxRef.current.x);
      const y = Math.min(cur.y, startPxRef.current.y);
      const w = Math.abs(cur.x - startPxRef.current.x);
      const h = Math.abs(cur.y - startPxRef.current.y);
      Object.assign(boxElRef.current.style, {
        left: x + "px",
        top: y + "px",
        width: w + "px",
        height: h + "px",
      });
    };

    const onMouseUp = (e: MouseEvent) => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      map.dragPan.enable();
      if (!selectingRef.current || !startPxRef.current) return;
      selectingRef.current = false;
      const rect = canvas.getBoundingClientRect();
      const end = { x: e.clientX - rect.left, y: e.clientY - rect.top };
      const start = startPxRef.current;
      startPxRef.current = null;
      if (boxElRef.current) {
        boxElRef.current.remove();
        boxElRef.current = null;
      }
      if (Math.abs(end.x - start.x) < 4 || Math.abs(end.y - start.y) < 4) {
        onSelectRef.current(null);
        return;
      }
      const a = map.unproject([start.x, start.y]);
      const b = map.unproject([end.x, end.y]);
      const bbox: BBox = {
        west: Math.min(a.lng, b.lng),
        east: Math.max(a.lng, b.lng),
        south: Math.min(a.lat, b.lat),
        north: Math.max(a.lat, b.lat),
      };
      drawBbox(map, bbox);
      onSelectRef.current(bbox);
    };

    canvas.addEventListener("mousedown", onMouseDown);

    return () => {
      canvas.removeEventListener("mousedown", onMouseDown);
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Swap style when the user picks a different map theme.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const def = getStyleDef(styleId);
    originalRoadColors.delete(map);
    map.once("styledata", () => {
      if (mapRef.current) {
        redrawStoredBbox(mapRef.current);
        applyLabelVisibility(mapRef.current, hideLabelsRef.current);
        applyBuildingVisibility(mapRef.current, hideBuildingsRef.current);
        applyRoadsColor(mapRef.current, roadsColorRef.current);
      }
    });
    map.setStyle(def.styleUrl);
  }, [styleId]);

  // Toggle label visibility without reloading the style.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    applyLabelVisibility(map, hideLabels);
  }, [hideLabels]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    applyBuildingVisibility(map, hideBuildings);
  }, [hideBuildings]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (map.isStyleLoaded()) {
      applyRoadsColor(map, roadsColor);
    } else {
      map.once("styledata", () => {
        if (mapRef.current) applyRoadsColor(mapRef.current, roadsColor);
      });
    }
  }, [roadsColor]);

  useImperativeHandle(ref, () => ({
    flyTo(lng, lat, zoom) {
      mapRef.current?.flyTo({ center: [lng, lat], zoom: zoom ?? 14 });
    },
    fitBbox(bbox) {
      const bounds: LngLatBoundsLike = [
        [bbox.west, bbox.south],
        [bbox.east, bbox.north],
      ];
      mapRef.current?.fitBounds(bounds, { padding: 60, duration: 600 });
      if (mapRef.current) drawBbox(mapRef.current, bbox);
    },
    clearSelection() {
      const map = mapRef.current;
      if (!map) return;
      clearBbox(map);
    },
    getProjectedFeatureSetForBbox(bbox) {
      const map = mapRef.current;
      if (!map) return null;
      return buildProjectedFeatureSetForBbox(map, bbox);
    },
    captureSelectedPng(bbox, scale) {
      const map = mapRef.current;
      if (!map) return Promise.reject(new Error("Map is not ready"));

      const originalPixelRatio = window.devicePixelRatio;
      const targetPixelRatio = originalPixelRatio * scale;

      const hasSelectionLayers =
        map.getLayer(SELECTION_FILL) && map.getLayer(SELECTION_LINE);

      const restoreAndCrop = (): Promise<Blob> => {
        const sourceCanvas = map.getCanvas();
        // At targetPixelRatio the canvas physical size is scaled up.
        // CSS crop coords stay in logical pixels so we scale them here.
        const crop = getCanvasCropForBbox(map, bbox);
        const ratio = sourceCanvas.width / sourceCanvas.clientWidth;
        const srcX = Math.round(crop.x * ratio);
        const srcY = Math.round(crop.y * ratio);
        const srcW = Math.max(1, Math.round(crop.width * ratio));
        const srcH = Math.max(1, Math.round(crop.height * ratio));

        const out = document.createElement("canvas");
        out.width = srcW;
        out.height = srcH;
        const ctx = out.getContext("2d");
        if (!ctx) return Promise.reject(new Error("Canvas export is not available"));
        ctx.drawImage(sourceCanvas, srcX, srcY, srcW, srcH, 0, 0, srcW, srcH);

        // Restore original pixel ratio immediately after reading the canvas.
        map.setPixelRatio(originalPixelRatio);
        if (hasSelectionLayers) {
          map.setLayoutProperty(SELECTION_FILL, "visibility", "visible");
          map.setLayoutProperty(SELECTION_LINE, "visibility", "visible");
        }

        return new Promise<Blob>((resolve, reject) => {
          out.toBlob((blob) => {
            if (!blob) { reject(new Error("PNG export failed")); return; }
            resolve(blob);
          }, "image/png");
        });
      };

      if (hasSelectionLayers) {
        map.setLayoutProperty(SELECTION_FILL, "visibility", "none");
        map.setLayoutProperty(SELECTION_LINE, "visibility", "none");
      }

      // Bump pixel ratio so MapLibre re-renders at the target resolution,
      // then capture on the next rendered frame.
      map.setPixelRatio(targetPixelRatio);
      return new Promise((resolve, reject) => {
        map.once("render", () => restoreAndCrop().then(resolve, reject));
        map.triggerRepaint();
      });
    },
  }));

  return (
    <div className="map-wrap">
      <div ref={containerRef} className="map" />
      <div className="help">
        Hold <span className="kbd">Shift</span> and drag to select an area
      </div>
    </div>
  );
});

const SELECTION_SOURCE = "selection-bbox";
const SELECTION_FILL = "selection-bbox-fill";
const SELECTION_LINE = "selection-bbox-line";

// Store last bbox so we can redraw it after a style change.
let storedBbox: BBox | null = null;

function redrawStoredBbox(map: MlMap) {
  if (storedBbox) drawBbox(map, storedBbox);
}

function applyLabelVisibility(map: MlMap, hide: boolean) {
  const visibility = hide ? "none" : "visible";
  map.getStyle().layers.forEach((layer) => {
    if (layer.type === "symbol") {
      map.setLayoutProperty(layer.id, "visibility", visibility);
    }
  });
}

// Snapshot original line-color of road layers the first time we touch them, so
// that clearing the override later can restore the style's authentic palette.
const originalRoadColors = new WeakMap<MlMap, Map<string, unknown>>();

function applyRoadsColor(map: MlMap, color: string | null) {
  let snapshot = originalRoadColors.get(map);
  if (!snapshot) {
    snapshot = new Map();
    originalRoadColors.set(map, snapshot);
  }

  map.getStyle().layers.forEach((layer) => {
    if (layer.type !== "line") return;
    const layerId = layer.id.toLowerCase();
    const sourceLayer = "source-layer" in layer ? String(layer["source-layer"] ?? "").toLowerCase() : "";
    const isRoadLayer =
      sourceLayer === "transportation" ||
      sourceLayer === "road" ||
      layerId.includes("road") ||
      layerId.includes("street") ||
      layerId.includes("highway") ||
      layerId.includes("motorway") ||
      layerId.includes("bridge") ||
      layerId.includes("tunnel") ||
      layerId.includes("path");
    if (!isRoadLayer) return;
    if (layerId.includes("rail") || layerId.includes("ferry") || layerId.includes("runway")) return;

    if (!snapshot!.has(layer.id)) {
      const current = map.getPaintProperty(layer.id, "line-color");
      snapshot!.set(layer.id, current);
    }

    if (color) {
      map.setPaintProperty(layer.id, "line-color", color);
    } else {
      map.setPaintProperty(layer.id, "line-color", snapshot!.get(layer.id));
    }
  });
}

function applyBuildingVisibility(map: MlMap, hide: boolean) {
  const visibility = hide ? "none" : "visible";
  map.getStyle().layers.forEach((layer) => {
    const layerId = layer.id.toLowerCase();
    const sourceLayer = "source-layer" in layer ? String(layer["source-layer"] ?? "").toLowerCase() : "";
    const isBuildingLayer =
      sourceLayer === "building" ||
      layerId.includes("building") ||
      layerId.includes("buildings") ||
      layerId.includes("3d-buildings");

    if (!isBuildingLayer) return;
    map.setLayoutProperty(layer.id, "visibility", visibility);
  });
}

function drawBbox(map: MlMap, bbox: BBox) {
  storedBbox = bbox;
  const data: GeoJSON.Feature = {
    type: "Feature",
    properties: {},
    geometry: {
      type: "Polygon",
      coordinates: [
        [
          [bbox.west, bbox.south],
          [bbox.east, bbox.south],
          [bbox.east, bbox.north],
          [bbox.west, bbox.north],
          [bbox.west, bbox.south],
        ],
      ],
    },
  };
  const apply = () => {
    const src = map.getSource(SELECTION_SOURCE) as maplibregl.GeoJSONSource | undefined;
    if (src) {
      src.setData(data);
    } else {
      map.addSource(SELECTION_SOURCE, { type: "geojson", data });
      const accent =
        getComputedStyle(document.documentElement).getPropertyValue("--accent").trim() ||
        "#0f766e";
      map.addLayer({
        id: SELECTION_FILL,
        type: "fill",
        source: SELECTION_SOURCE,
        paint: { "fill-color": accent, "fill-opacity": 0.14 },
      });
      map.addLayer({
        id: SELECTION_LINE,
        type: "line",
        source: SELECTION_SOURCE,
        paint: { "line-color": accent, "line-width": 2, "line-dasharray": [3, 2] },
      });
    }
  };
  if (map.isStyleLoaded()) apply();
  else map.once("styledata", apply);
}

function clearBbox(map: MlMap) {
  storedBbox = null;
  const src = map.getSource(SELECTION_SOURCE) as maplibregl.GeoJSONSource | undefined;
  if (src) {
    src.setData({
      type: "FeatureCollection",
      features: [],
    });
  }
}

function buildProjectedFeatureSetForBbox(map: MlMap, bbox: BBox): ProjectedFeatureSet {
  const crop = getCanvasCropForBbox(map, bbox);
  const { x: minX, y: minY, width, height } = crop;
  const rendered = map.queryRenderedFeatures(
    [
      [minX, minY],
      [minX + width, minY + height],
    ],
  );
  const features: ProjectedFeatureSet["features"] = [];
  const seen = new Set<string>();

  for (const renderedFeature of rendered) {
    if (renderedFeature.source === SELECTION_SOURCE) continue;

    const layerKind = classifyRenderedFeature(renderedFeature);
    if (!layerKind) continue;

    const geometries = normalizeGeometry(renderedFeature.geometry);
    if (geometries.length === 0) continue;

    const baseId = buildFeatureBaseId(renderedFeature, layerKind);
    const name = readFeatureName(renderedFeature.properties);

    geometries.forEach((geometry, index) => {
      const d = projectedPathFromGeometry(map, geometry, minX, minY);
      if (!d) return;
      const signature = `${layerKind}|${d}`;
      if (seen.has(signature)) return;
      seen.add(signature);
      features.push({
        id: `${baseId}-${index}`,
        layer: layerKind,
        name,
        d,
      });
    });
  }

  return {
    width,
    height,
    features,
  };
}

function getCanvasCropForBbox(map: MlMap, bbox: BBox) {
  const sw = map.project([bbox.west, bbox.south]);
  const ne = map.project([bbox.east, bbox.north]);
  const minX = Math.min(sw.x, ne.x);
  const maxX = Math.max(sw.x, ne.x);
  const minY = Math.min(sw.y, ne.y);
  const maxY = Math.max(sw.y, ne.y);

  return {
    x: minX,
    y: minY,
    width: Math.max(1, Math.round(maxX - minX)),
    height: Math.max(1, Math.round(maxY - minY)),
  };
}

function classifyRenderedFeature(feature: {
  geometry: { type: string };
  layer?: { id?: string; type?: string };
  properties?: Record<string, unknown>;
  source?: string;
  sourceLayer?: string;
}): LayerKind | null {
  const layerId = String(feature.layer?.id ?? "").toLowerCase();
  const layerType = String(feature.layer?.type ?? "").toLowerCase();
  const sourceLayer = String(feature.sourceLayer ?? "").toLowerCase();
  const geomType = feature.geometry.type;
  const props = feature.properties ?? {};
  const className = String(props.class ?? props.type ?? "").toLowerCase();
  const subclass = String(props.subclass ?? "").toLowerCase();
  const leisure = String(props.leisure ?? "").toLowerCase();
  const landuse = String(props.landuse ?? "").toLowerCase();
  const natural = String(props.natural ?? "").toLowerCase();

  if (layerType === "symbol" || geomType === "Point" || geomType === "MultiPoint") return null;

  if (sourceLayer === "building" || layerId.includes("building")) {
    return isPolygonGeometry(geomType) ? "buildings" : null;
  }

  if (
    sourceLayer === "water" ||
    sourceLayer === "waterway" ||
    layerId.includes("water") ||
    layerId.includes("ocean") ||
    layerId.includes("river") ||
    layerId.includes("lake")
  ) {
    return geomType === "LineString" || geomType === "MultiLineString" ? "roads" : "water";
  }

  if (sourceLayer === "park") {
    return isPolygonGeometry(geomType) ? "parks" : null;
  }

  if (sourceLayer === "landuse" || sourceLayer === "landcover" || layerId.includes("park")) {
    const parkLike =
      PARK_CLASSES.has(className) ||
      PARK_CLASSES.has(subclass) ||
      PARK_CLASSES.has(leisure) ||
      PARK_CLASSES.has(landuse) ||
      PARK_CLASSES.has(natural);
    if (parkLike && isPolygonGeometry(geomType)) return "parks";
  }

  if (
    sourceLayer === "transportation" ||
    sourceLayer === "road" ||
    layerId.includes("road") ||
    layerId.includes("street") ||
    layerId.includes("bridge") ||
    layerId.includes("tunnel") ||
    layerId.includes("path")
  ) {
    const blocked =
      ROAD_EXCLUSIONS.has(className) ||
      ROAD_EXCLUSIONS.has(subclass) ||
      layerId.includes("rail");
    return blocked ? null : "roads";
  }

  return null;
}

const PARK_CLASSES = new Set([
  "allotments",
  "garden",
  "grass",
  "greenfield",
  "meadow",
  "park",
  "pitch",
  "playground",
  "recreation_ground",
  "recreational",
  "village_green",
  "wood",
]);

const ROAD_EXCLUSIONS = new Set([
  "ferry",
  "rail",
  "railway",
  "runway",
  "subway",
  "tram",
]);

function isPolygonGeometry(type: string): boolean {
  return type === "Polygon" || type === "MultiPolygon";
}

function normalizeGeometry(geometry: {
  type: string;
  coordinates?: unknown;
}): Geometry[] {
  switch (geometry.type) {
    case "LineString":
      return isCoordPairArray(geometry.coordinates)
        ? [{ type: "LineString", coords: geometry.coordinates.map(toLngLat) }]
        : [];
    case "MultiLineString":
      return isNestedCoordPairArray(geometry.coordinates)
        ? geometry.coordinates.map((coords) => ({ type: "LineString", coords: coords.map(toLngLat) }))
        : [];
    case "Polygon":
      return isPolygonCoords(geometry.coordinates)
        ? [{ type: "Polygon", rings: geometry.coordinates.map((ring) => ring.map(toLngLat)) }]
        : [];
    case "MultiPolygon":
      return isMultiPolygonCoords(geometry.coordinates)
        ? geometry.coordinates.map((rings) => ({
            type: "Polygon",
            rings: rings.map((ring) => ring.map(toLngLat)),
          }))
        : [];
    default:
      return [];
  }
}

function toLngLat(pair: [number, number]): LngLat {
  return { lng: pair[0], lat: pair[1] };
}

function readFeatureName(properties?: Record<string, unknown>): string | undefined {
  const value = properties?.name;
  return typeof value === "string" && value.trim() ? value : undefined;
}

function buildFeatureBaseId(
  feature: {
    id?: string | number;
    source?: string;
    sourceLayer?: string;
    layer?: { id?: string };
    properties?: Record<string, unknown>;
  },
  layerKind: LayerKind,
): string {
  const id = feature.id ?? feature.properties?.osm_id ?? feature.properties?.id ?? "feature";
  const source = String(feature.source ?? "map");
  const sourceLayer = String(feature.sourceLayer ?? feature.layer?.id ?? layerKind);
  return `${source}-${sourceLayer}-${id}`.replace(/[^a-zA-Z0-9_-]+/g, "-");
}

function projectedPathFromGeometry(map: MlMap, geometry: Geometry, offsetX: number, offsetY: number): string {
  if (geometry.type === "LineString") {
    return projectedPathFromCoords(map, geometry.coords, false, offsetX, offsetY);
  }
  return geometry.rings
    .map((ring) => projectedPathFromCoords(map, ring, true, offsetX, offsetY))
    .filter(Boolean)
    .join(" ");
}

function projectedPathFromCoords(
  map: MlMap,
  coords: LngLat[],
  close: boolean,
  offsetX: number,
  offsetY: number,
): string {
  if (coords.length === 0) return "";
  let d = "";
  for (let i = 0; i < coords.length; i++) {
    const point = map.project([coords[i].lng, coords[i].lat]);
    const x = Math.round((point.x - offsetX) * 100) / 100;
    const y = Math.round((point.y - offsetY) * 100) / 100;
    d += `${i === 0 ? "M" : "L"}${x} ${y} `;
  }
  if (close) d += "Z";
  return d.trim();
}

function isCoordPair(value: unknown): value is [number, number] {
  return Array.isArray(value) && value.length >= 2 && typeof value[0] === "number" && typeof value[1] === "number";
}

function isCoordPairArray(value: unknown): value is [number, number][] {
  return Array.isArray(value) && value.every(isCoordPair);
}

function isNestedCoordPairArray(value: unknown): value is [number, number][][] {
  return Array.isArray(value) && value.every(isCoordPairArray);
}

function isPolygonCoords(value: unknown): value is [number, number][][] {
  return isNestedCoordPairArray(value);
}

function isMultiPolygonCoords(value: unknown): value is [number, number][][][] {
  return Array.isArray(value) && value.every(isPolygonCoords);
}
