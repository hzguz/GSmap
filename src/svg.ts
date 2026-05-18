import type { BBox, Feature, FeatureSet, LayerKind, LngLat } from "./types";
import type { ThemeTokens } from "./theme";

export type ProjectedFeature = {
  id: string;
  layer: LayerKind;
  name?: string;
  d: string;
};

export type ProjectedFeatureSet = {
  width: number;
  height: number;
  features: ProjectedFeature[];
};

// Project lon/lat into a planar canvas using Web Mercator. We do the
// projection inside the bbox and then normalize to viewBox units. This keeps
// shapes faithful to what users see in a Mercator preview without baking pixel
// sizes into the file.

function mercator(p: LngLat): { x: number; y: number } {
  const x = (p.lng * Math.PI) / 180;
  const y = Math.log(Math.tan(Math.PI / 4 + (p.lat * Math.PI) / 180 / 2));
  return { x, y };
}

type Projector = (p: LngLat) => { x: number; y: number };

function makeProjector(bbox: BBox, width: number, height: number): Projector {
  const sw = mercator({ lng: bbox.west, lat: bbox.south });
  const ne = mercator({ lng: bbox.east, lat: bbox.north });
  const dx = ne.x - sw.x;
  const dy = ne.y - sw.y;
  // Preserve aspect ratio; scale uniformly using the larger dimension.
  const scale = Math.min(width / dx, height / dy);
  const offsetX = (width - dx * scale) / 2;
  const offsetY = (height - dy * scale) / 2;
  return (p: LngLat) => {
    const m = mercator(p);
    return {
      x: offsetX + (m.x - sw.x) * scale,
      // Flip Y so north is up in SVG coordinates.
      y: height - (offsetY + (m.y - sw.y) * scale),
    };
  };
}

function fmt(n: number): string {
  return Math.round(n * 100) / 100 + "";
}

function pathFromCoords(coords: LngLat[], project: Projector, close: boolean): string {
  if (coords.length === 0) return "";
  let d = "";
  for (let i = 0; i < coords.length; i++) {
    const { x, y } = project(coords[i]);
    d += (i === 0 ? "M" : "L") + fmt(x) + " " + fmt(y) + " ";
  }
  if (close) d += "Z";
  return d.trim();
}

const LAYER_ORDER: LayerKind[] = ["water", "parks", "buildings", "roads"];

const STROKE_WIDTH: Record<LayerKind, number> = {
  water: 1.5,
  parks: 0,
  buildings: 0.25,
  roads: 1.2,
};

function styleForLayer(layer: LayerKind, t: ThemeTokens): { fill: string; stroke: string; strokeWidth: number } {
  switch (layer) {
    case "water":
      return { fill: t.water, stroke: t.water, strokeWidth: STROKE_WIDTH.water };
    case "parks":
      return { fill: t.parks, stroke: "none", strokeWidth: 0 };
    case "buildings":
      return { fill: t.buildings, stroke: t.buildings, strokeWidth: STROKE_WIDTH.buildings };
    case "roads":
      return { fill: "none", stroke: t.roads, strokeWidth: STROKE_WIDTH.roads };
  }
}

// Returns the midpoint of the first M…L segment in a path `d` string.
// Used to anchor labels without a full geometry centroid calculation.
function labelPointFromPath(d: string): { x: number; y: number } | null {
  const coords = d.match(/[ML]\s*([\d.]+)\s+([\d.]+)/gi);
  if (!coords || coords.length === 0) return null;
  let sumX = 0, sumY = 0;
  for (const token of coords) {
    const parts = token.slice(1).trim().split(/\s+/);
    sumX += parseFloat(parts[0]);
    sumY += parseFloat(parts[1]);
  }
  return { x: sumX / coords.length, y: sumY / coords.length };
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function pathForFeature(f: Feature, project: Projector): string {
  if (f.geometry.type === "LineString") {
    return pathFromCoords(f.geometry.coords, project, false);
  }
  return f.geometry.rings
    .map((r) => pathFromCoords(r, project, true))
    .filter(Boolean)
    .join(" ");
}

export type ExportOptions = {
  width?: number;
  height?: number;
};

// Compute output canvas dimensions that match the bbox aspect ratio (in Web
// Mercator), capping the longer side at `maxSide`. Without this the SVG ends
// up letterboxed inside a square viewBox.
function dimsForBbox(bbox: BBox, maxSide: number): { width: number; height: number } {
  const sw = mercator({ lng: bbox.west, lat: bbox.south });
  const ne = mercator({ lng: bbox.east, lat: bbox.north });
  const dx = Math.abs(ne.x - sw.x);
  const dy = Math.abs(ne.y - sw.y);
  if (dx === 0 || dy === 0) return { width: maxSide, height: maxSide };
  const aspect = dx / dy;
  if (aspect >= 1) {
    return { width: maxSide, height: Math.round(maxSide / aspect) };
  }
  return { width: Math.round(maxSide * aspect), height: maxSide };
}

export function generateSvg(
  set: FeatureSet,
  tokens: ThemeTokens,
  opts: ExportOptions = {},
): string {
  const fallback = dimsForBbox(set.bbox, 1024);
  const width = opts.width ?? fallback.width;
  const height = opts.height ?? fallback.height;
  const project = makeProjector(set.bbox, width, height);

  const byLayer = new Map<LayerKind, Feature[]>();
  for (const layer of LAYER_ORDER) byLayer.set(layer, []);
  for (const f of set.features) {
    const arr = byLayer.get(f.layer);
    if (arr) arr.push(f);
  }

  const groups: string[] = [];
  for (const layer of LAYER_ORDER) {
    const items = byLayer.get(layer)!;
    if (items.length === 0) continue;
    const style = styleForLayer(layer, tokens);
    const styleAttr =
      `fill="${style.fill}" stroke="${style.stroke}" stroke-width="${style.strokeWidth}"` +
      (layer === "roads" ? ` stroke-linecap="round" stroke-linejoin="round"` : "") +
      (layer === "buildings" || layer === "parks" || (layer === "water" && style.fill !== "none")
        ? ` fill-rule="evenodd"`
        : "");
    // Use data-name for the human-readable label; id stays unique via the
    // feature's stable OSM id so the SVG is always well-formed.
    const paths = items
      .map((f) => {
        const d = pathForFeature(f, project);
        if (!d) return "";
        const idAttr = ` id="${f.id.replace(/\//g, "-")}"`;
        const nameAttr = f.name ? ` data-name="${escapeXml(f.name)}"` : "";
        return `    <path${idAttr}${nameAttr} d="${d}"/>`;
      })
      .filter(Boolean)
      .join("\n");
    groups.push(`  <g id="${layer}" ${styleAttr}>\n${paths}\n  </g>`);
  }

  const bg = `  <rect id="background" x="0" y="0" width="${width}" height="${height}" fill="${tokens.background}"/>`;

  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">`,
    `  <metadata>Map data © OpenStreetMap contributors, ODbL.</metadata>`,
    bg,
    ...groups,
    `</svg>`,
  ].join("\n");
}

export function generateProjectedSvg(
  set: ProjectedFeatureSet,
  tokens: ThemeTokens,
  showLabels = false,
): string {
  const groups: string[] = [];

  for (const layer of LAYER_ORDER) {
    const items = set.features.filter((feature) => feature.layer === layer);
    if (items.length === 0) continue;
    const style = styleForLayer(layer, tokens);
    const styleAttr =
      `fill="${style.fill}" stroke="${style.stroke}" stroke-width="${style.strokeWidth}"` +
      (layer === "roads" ? ` stroke-linecap="round" stroke-linejoin="round"` : "") +
      (layer === "buildings" || layer === "parks" || (layer === "water" && style.fill !== "none")
        ? ` fill-rule="evenodd"`
        : "");
    const paths = items
      .map((feature) => {
        const idAttr = ` id="${feature.id.replace(/\//g, "-")}"`;
        const nameAttr = feature.name ? ` data-name="${escapeXml(feature.name)}"` : "";
        return `    <path${idAttr}${nameAttr} d="${feature.d}"/>`;
      })
      .join("\n");
    groups.push(`  <g id="${layer}" ${styleAttr}>\n${paths}\n  </g>`);
  }

  if (showLabels) {
    const fontSize = Math.max(8, Math.round(Math.min(set.width, set.height) * 0.012));
    const textEls = set.features
      .filter((f) => f.name)
      .map((f) => {
        const pt = labelPointFromPath(f.d);
        if (!pt) return "";
        const id = `label-${f.id.replace(/\//g, "-")}`;
        return `    <text id="${id}" x="${fmt(pt.x)}" y="${fmt(pt.y)}" dominant-baseline="middle" text-anchor="middle">${escapeXml(f.name!)}</text>`;
      })
      .filter(Boolean)
      .join("\n");
    if (textEls) {
      const labelStyle = `font-family="sans-serif" font-size="${fontSize}" fill="${tokens.labels}" pointer-events="none"`;
      groups.push(`  <g id="labels" ${labelStyle}>\n${textEls}\n  </g>`);
    }
  }

  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${set.width} ${set.height}" width="${set.width}" height="${set.height}">`,
    `  <metadata>Map data © OpenStreetMap contributors, ODbL.</metadata>`,
    `  <rect id="background" x="0" y="0" width="${set.width}" height="${set.height}" fill="${tokens.background}"/>`,
    ...groups,
    `</svg>`,
  ].join("\n");
}

export function downloadPng(svg: string, scale: 1 | 2 | 3, filename: string): Promise<void> {
  return new Promise((resolve, reject) => {
    // Read intrinsic dimensions from the SVG so the canvas matches the bbox
    // aspect ratio instead of forcing a square.
    const wMatch = svg.match(/<svg[^>]*\swidth="(\d+(?:\.\d+)?)"/);
    const hMatch = svg.match(/<svg[^>]*\sheight="(\d+(?:\.\d+)?)"/);
    const baseW = wMatch ? parseFloat(wMatch[1]) : 1024;
    const baseH = hMatch ? parseFloat(hMatch[1]) : 1024;
    const outW = Math.round(baseW * scale);
    const outH = Math.round(baseH * scale);
    const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = outW;
      canvas.height = outH;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0, outW, outH);
      URL.revokeObjectURL(url);
      canvas.toBlob((pngBlob) => {
        if (!pngBlob) return reject(new Error("PNG export failed"));
        const a = document.createElement("a");
        a.href = URL.createObjectURL(pngBlob);
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(a.href);
        resolve();
      }, "image/png");
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to render SVG to canvas"));
    };
    img.src = url;
  });
}

export function downloadSvg(svg: string, filename: string): void {
  const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
  downloadBlob(blob, filename);
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
