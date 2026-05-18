import type { BBox, Feature, FeatureSet, Geometry, LayerKind, LngLat } from "./types";

const OVERPASS_URL = "https://overpass-api.de/api/interpreter";

type OsmWay = {
  type: "way";
  id: number;
  geometry?: { lat: number; lon: number }[];
  tags?: Record<string, string>;
};
type OsmRelation = {
  type: "relation";
  id: number;
  members: {
    type: "node" | "way" | "relation";
    ref: number;
    role: string;
    geometry?: { lat: number; lon: number }[];
  }[];
  tags?: Record<string, string>;
};
type OsmElement = { type: "node"; id: number } | OsmWay | OsmRelation;

type OverpassResponse = { elements: OsmElement[] };

function buildQuery(bbox: BBox): string {
  const bb = `${bbox.south},${bbox.west},${bbox.north},${bbox.east}`;
  return `
[out:json][timeout:30];
(
  way["highway"](${bb});
  way["waterway"](${bb});
  way["natural"="water"](${bb});
  relation["natural"="water"](${bb});
  way["water"](${bb});
  way["leisure"~"^(park|garden|nature_reserve)$"](${bb});
  relation["leisure"~"^(park|garden|nature_reserve)$"](${bb});
  way["landuse"~"^(grass|forest|recreation_ground|meadow|cemetery)$"](${bb});
  way["natural"~"^(wood|grassland|scrub)$"](${bb});
  way["building"](${bb});
  relation["building"](${bb});
);
out geom tags;
  `.trim();
}

function classifyTags(tags?: Record<string, string>): LayerKind | null {
  if (!tags) return null;
  if (tags.building) return "buildings";
  if (tags.highway) return "roads";
  if (tags.waterway || tags.water || tags.natural === "water") return "water";
  if (
    tags.leisure === "park" ||
    tags.leisure === "garden" ||
    tags.leisure === "nature_reserve" ||
    tags.landuse === "grass" ||
    tags.landuse === "forest" ||
    tags.landuse === "recreation_ground" ||
    tags.landuse === "meadow" ||
    tags.landuse === "cemetery" ||
    tags.natural === "wood" ||
    tags.natural === "grassland" ||
    tags.natural === "scrub"
  )
    return "parks";
  return null;
}

function geomToCoords(geom?: { lat: number; lon: number }[]): LngLat[] {
  return (geom ?? []).map((p) => ({ lng: p.lon, lat: p.lat }));
}

function isClosed(coords: LngLat[]): boolean {
  if (coords.length < 4) return false;
  const a = coords[0];
  const b = coords[coords.length - 1];
  return Math.abs(a.lng - b.lng) < 1e-8 && Math.abs(a.lat - b.lat) < 1e-8;
}

// A way is linear if the feature is a road or a waterway (river, canal, etc.).
// Area water (lake, reservoir) and all other layers are treated as polygons.
function isLinear(layer: LayerKind, tags?: Record<string, string>): boolean {
  if (layer === "roads") return true;
  if (layer === "water" && tags?.waterway) return true;
  return false;
}

export async function fetchFeatures(bbox: BBox): Promise<FeatureSet> {
  const body = "data=" + encodeURIComponent(buildQuery(bbox));
  const res = await fetch(OVERPASS_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) {
    throw new Error(`Overpass error ${res.status}: ${await res.text()}`);
  }
  const data: OverpassResponse = await res.json();

  const features: Feature[] = [];

  for (const el of data.elements) {
    if (el.type === "node") continue;

    const layer = classifyTags(el.tags);
    if (!layer) continue;

    if (el.type === "way") {
      const coords = geomToCoords(el.geometry);
      if (coords.length < 2) continue;

      let geometry: Geometry;
      if (isLinear(layer, el.tags)) {
        geometry = { type: "LineString", coords };
      } else {
        // Ensure ring is closed.
        const ring = isClosed(coords) ? coords : [...coords, coords[0]];
        geometry = { type: "Polygon", rings: [ring] };
      }

      features.push({
        id: `way/${el.id}`,
        layer,
        name: el.tags?.name,
        geometry,
      });
    } else if (el.type === "relation") {
      const outer: LngLat[][] = [];
      const inner: LngLat[][] = [];
      for (const m of el.members ?? []) {
        if (m.type !== "way" || !m.geometry) continue;
        const ring = geomToCoords(m.geometry);
        if (ring.length < 3) continue;
        const closed = isClosed(ring) ? ring : [...ring, ring[0]];
        if (m.role === "inner") inner.push(closed);
        else outer.push(closed);
      }
      if (outer.length === 0) continue;
      for (const o of outer) {
        features.push({
          id: `rel/${el.id}/${features.length}`,
          layer,
          name: el.tags?.name,
          geometry: { type: "Polygon", rings: [o, ...inner] },
        });
      }
    }
  }

  return { bbox, features };
}
