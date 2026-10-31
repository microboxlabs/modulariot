# Boundary data provenance and reuse

`districts-pe.json.gz` is derived from the INEI district layer distributed by
[juaneladio/peru-geojson](https://github.com/juaneladio/peru-geojson).
This derived data retains the **MPL-2.0** license; a copy is in
[LICENSE-MPL-2.0.txt](LICENSE-MPL-2.0.txt). The source and the transformations in
`miot-trips/scripts/build_boundaries.py` are available to reproduce it.

`communes-cl.json.gz` is derived from the **Biblioteca del Congreso Nacional de
Chile** vector maps, converted to GeoJSON by
[caracena/chile-geojson](https://github.com/caracena/chile-geojson) and simplified
by our boundary builder. The [official BCN conditions](https://www.bcn.cl/siit/mapas_vectoriales)
permit reuse with attribution to the Biblioteca del Congreso Nacional de Chile.
The converter mirror has no separate license file; no additional grant from
that mirror is asserted here.

These source-specific terms apply to the boundary data alongside the repository
license. The shapes are approximate reference data, unsuitable for geodetic
precision. This application rounds coordinates and simplifies the Chile layer;
its boundary checks are not an authoritative survey.
