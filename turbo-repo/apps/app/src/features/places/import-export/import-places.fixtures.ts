/** Solo para tests: archivos de ejemplo alrededor de Santiago (Quilicura / Ruta 5) que lee el import. */

export const EJEMPLO_CSV = `name,lat,lon,radius_m,address,external_id
Planta Quilicura,-33.3602,-70.7315,200,Ruta 5 Norte,planta-q
Bodega Lo Boza,-33.3751,-70.7680,150,Camino Lo Boza,bodega-lb
Puerto San Antonio,-33.5800,-71.6130,300,San Antonio,pto-sa
Patio rectangular,-33.3610,-70.7335,0,Quilicura,patio-rect
`;

export const EJEMPLO_CSV_POLIGONO = `name,west,south,east,north,address
Galpón Lo Echevers,-70.7350,-33.3620,-70.7320,-33.3600,Lo Echevers
`;

export const EJEMPLO_KML = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>Lugares de prueba</name>
    <Placemark>
      <name>Tótem acceso planta</name>
      <address>Ruta 5 Norte</address>
      <Point>
        <coordinates>-70.7315,-33.3602,0</coordinates>
      </Point>
    </Placemark>
    <Placemark>
      <name>Galpón rectangular</name>
      <Polygon>
        <outerBoundaryIs>
          <LinearRing>
            <coordinates>
              -70.7350,-33.3620,0
              -70.7320,-33.3620,0
              -70.7320,-33.3600,0
              -70.7350,-33.3600,0
              -70.7350,-33.3620,0
            </coordinates>
          </LinearRing>
        </outerBoundaryIs>
      </Polygon>
    </Placemark>
    <Placemark>
      <name>Estacionamiento norte</name>
      <Polygon>
        <outerBoundaryIs>
          <LinearRing>
            <coordinates>
              -70.7300,-33.3580,0
              -70.7285,-33.3572,0
              -70.7270,-33.3588,0
              -70.7288,-33.3596,0
              -70.7300,-33.3580,0
            </coordinates>
          </LinearRing>
        </outerBoundaryIs>
      </Polygon>
    </Placemark>
  </Document>
</kml>
`;

export const EJEMPLO_GEOJSON = `{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "properties": {
        "name": "Planta Quilicura",
        "address": "Ruta 5 Norte",
        "external_id": "planta-q",
        "radius_m": 200
      },
      "geometry": { "type": "Point", "coordinates": [-70.7315, -33.3602] }
    },
    {
      "type": "Feature",
      "properties": { "name": "Patio rectangular" },
      "geometry": {
        "type": "Polygon",
        "coordinates": [[
          [-70.7350, -33.3620],
          [-70.7320, -33.3620],
          [-70.7320, -33.3600],
          [-70.7350, -33.3600],
          [-70.7350, -33.3620]
        ]]
      }
    },
    {
      "type": "Feature",
      "properties": { "name": "Cuadrado de acopio" },
      "geometry": {
        "type": "Square",
        "coordinates": [[-70.7290, -33.3610], [-70.7280, -33.3600]]
      }
    },
    {
      "type": "Feature",
      "properties": { "name": "Zona bbox" },
      "bbox": [-70.7400, -33.3650, -70.7380, -33.3630],
      "geometry": null
    }
  ]
}
`;
