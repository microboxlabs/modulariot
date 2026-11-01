// Cursores contextuales del editor de lugares.

// "+" negro con borde blanco: se ve sobre calles, satélite y modo oscuro.
const SVG_AGREGAR = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path d="M12 4v16M4 12h16" stroke="white" stroke-width="5" stroke-linecap="round"/><path d="M12 4v16M4 12h16" stroke="black" stroke-width="2" stroke-linecap="round"/></svg>`;

/** Clic en el mapa agrega un punto. Hotspot al centro; fallback crosshair. */
export const CURSOR_AGREGAR = `url("data:image/svg+xml,${encodeURIComponent(SVG_AGREGAR)}") 12 12, crosshair`;

/** Puntos sobre el mapa: clicables y arrastrables. */
export const CURSOR_PUNTO_CLS = "cursor-pointer active:cursor-grabbing";
