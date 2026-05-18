# gsmap

Open source web app for selecting an area of an OpenStreetMap-based map and
exporting it as a real, editable vector **SVG** ready for any design or
illustration tool.

- Search by place name (Nominatim) or by coordinates
- Pan/zoom the map and select a rectangular area (Shift + drag)
- Fetch real OSM vector data for the selection (Overpass API)
- Export an SVG with grouped layers: `roads`, `water`, `parks`, `buildings`,
  plus a `background` rect
- Light / dark themes with primary & secondary color customization. The same
  tokens drive both the preview tinting and the exported SVG fills/strokes
- 100% open source, all dependencies and data sources are commercial-use
  friendly (subject to each service's usage policy — see below)

## Stack

- React + TypeScript + Vite (MIT)
- MapLibre GL JS (BSD-3) for the interactive map
- OpenStreetMap raster tiles for the preview (ODbL)
- Nominatim for name search (ODbL data; OSMF service)
- Overpass API for vector data (ODbL data)

No backend is required for development. The browser calls Nominatim and
Overpass directly.

## Run locally

```sh
yarn
yarn dev
```

Open http://localhost:5173.

To produce a production build:

```sh
yarn build
yarn preview
```

## Usage

1. Search for a place by name, or paste `lat, lon` and press Go.
2. Hold **Shift** and drag a rectangle on the map.
3. Pick a theme; optionally tweak primary/secondary colors.
4. Click **Export SVG** — gsmap fetches Overpass vector data for the bounding
   box and downloads an SVG.
5. Open the SVG in your vector editor of choice. Layers are grouped by type
   so you can edit them independently.

## SVG structure

```
<svg>
  <metadata>Map data © OpenStreetMap contributors, ODbL.</metadata>
  <rect id="background" .../>
  <g id="water" ...>...</g>
  <g id="parks" ...>...</g>
  <g id="buildings" ...>...</g>
  <g id="roads" ...>...</g>
</svg>
```

Coordinates are projected with Web Mercator and normalized to the SVG
`viewBox` so the file is resolution-independent.

## Licensing & attribution

- This project is MIT licensed.
- Map data © OpenStreetMap contributors, available under the
  [Open Database License (ODbL)](https://www.openstreetmap.org/copyright).
  The exported SVG embeds a `<metadata>` attribution element. When publishing
  artwork derived from these exports, keep an OSM credit visible.
- Tile and Nominatim/Overpass requests go to the public OpenStreetMap
  Foundation services. **Their usage policies forbid heavy automated or
  high-volume commercial use.** For production at scale, switch to a
  self-hosted Overpass + Nominatim, or a commercial OSM-based provider.

## Notes & limitations

- Multipolygon water/parks are assembled with a best-effort heuristic; very
  complex polygons (rivers with islands, donut parks) may render with minor
  topology issues.
- Labels are not exported (positioning OSM labels into a clean SVG is its own
  problem). The `labels` token exists for future use.
- For very large bounding boxes, Overpass may time out — pick smaller areas
  for clean exports.
