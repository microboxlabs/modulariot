# Administrative boundaries

Built by `scripts/build_boundaries.py`. Each file holds one country's boundaries with code, name, province, region, a reference point inside the area (`centroid`, used to recover short Plus Codes), bounding box and a `MultiPolygon` in longitude and latitude.

| File | Country | Source | Code |
|------|---------|--------|------|
| `districts-pe.json.gz` | Peru, 1,834 districts | INEI layer via [juaneladio/peru-geojson](https://github.com/juaneladio/peru-geojson) `peru_distrital_simple.geojson` (MPL-2.0) | `IDDIST`, the 6-digit ubigeo |
| `communes-cl.json.gz` | Chile, 345 communes | BCN vector maps via [caracena/chile-geojson](https://github.com/caracena/chile-geojson), simplified to 0.0002° | `cod_comuna`, the 5-digit CUT |

Eight Peruvian districts have no geometry in the source (010204, 010523, 020602, 070105, 150137, 190203, 200602, 210103). A location declared in one of them stays in review.
