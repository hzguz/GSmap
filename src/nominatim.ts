// Nominatim usage policy: https://operations.osmfoundation.org/policies/nominatim/
// — max 1 req/s, must identify with referer, no heavy automated use.
// We let the browser send the Referer header and rate-limit on our side.

const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";

export type SearchResult = {
  display_name: string;
  lat: number;
  lon: number;
  boundingbox: [number, number, number, number]; // [south, north, west, east]
};

let lastCall = 0;

export async function searchPlace(query: string): Promise<SearchResult[]> {
  const wait = Math.max(0, 1100 - (Date.now() - lastCall));
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastCall = Date.now();

  const url = `${NOMINATIM_URL}?format=json&limit=8&q=${encodeURIComponent(query)}`;
  const res = await fetch(url, {
    headers: { Accept: "application/json", "User-Agent": "gsmap/1.0 (https://github.com/hzguz/gsmap)" },
  });
  if (!res.ok) throw new Error(`Nominatim error ${res.status}`);
  const raw = (await res.json()) as Array<{
    display_name: string;
    lat: string;
    lon: string;
    boundingbox: [string, string, string, string];
  }>;
  return raw.map((r) => ({
    display_name: r.display_name,
    lat: parseFloat(r.lat),
    lon: parseFloat(r.lon),
    boundingbox: [
      parseFloat(r.boundingbox[0]),
      parseFloat(r.boundingbox[1]),
      parseFloat(r.boundingbox[2]),
      parseFloat(r.boundingbox[3]),
    ],
  }));
}

export function parseCoordinates(input: string): { lat: number; lon: number } | null {
  const m = input
    .trim()
    .match(/^(-?\d+(?:\.\d+)?)[\s,]+(-?\d+(?:\.\d+)?)$/);
  if (!m) return null;
  const lat = parseFloat(m[1]);
  const lon = parseFloat(m[2]);
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return null;
  return { lat, lon };
}
