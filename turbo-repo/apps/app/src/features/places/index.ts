// Lugares de interés: geocercas, trayectos, su importación y versiones.
// Lo que usa la vista geográfica sale de aquí; lo demás es interno del módulo.
//
//   data/           PT4, respaldo local, geocodificación y Plus Codes
//   hooks/          estado del editor (usePlacesWorkspace)
//   geofences/      formulario y edición de geocercas e interiores
//   routes/         formulario y edición de trayectos
//   catalog/        listas, búsqueda, selección y exportar
//   import-export/  importar (KML, GeoJSON, CSV) y exportar
//   map/            capas, badges, clusters, menús y overlays del mapa
//   versioning/     versiones y diálogo de nueva versión
//   ui/             piezas de formulario compartidas
export {
  usePlacesWorkspace,
  type PlacesWorkspace,
} from "./hooks/use-places-workspace";
export { FORM_VACIO } from "./places.types";
export { PANEL_LUGARES } from "./panel";
export { PlacesCatalogLists, PlacesImportCard } from "./catalog/places-catalog";
export {
  PlacesEditorOverlays,
  PlacesStackedFormCards,
} from "./map/places-editor-overlays";
export { default as PlacesMapLayers } from "./map/places-map-layers";
export { default as PlaceBadgeTooltip } from "./map/place-badge-tooltip";
export { CURSOR_AGREGAR } from "./map/cursors";
export { itemsNombresMapa, type ItemNombre } from "./map/place-labels";
export { capasNombresGeocercas } from "./map/place-name-layer";
export { useResaltadoAnimado } from "./map/highlight-animation";
export { zoomAlClicNombre } from "./map/geofence-lod";
