export type LngLat = { lng: number; lat: number };

export type BBox = {
  // [west, south, east, north]
  west: number;
  south: number;
  east: number;
  north: number;
};

export type LayerKind = "roads" | "water" | "parks" | "buildings";

export type Geometry =
  | { type: "LineString"; coords: LngLat[] }
  | { type: "Polygon"; rings: LngLat[][] }; // first ring outer, rest holes

export type Feature = {
  id: string;
  layer: LayerKind;
  name?: string;
  geometry: Geometry;
};

export type FeatureSet = {
  bbox: BBox;
  features: Feature[];
};
