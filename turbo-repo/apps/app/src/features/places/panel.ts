// Barra lateral de Lugares en la vista geográfica: su ancho en un solo lugar.
// Las clases van escritas tal cual para que Tailwind las genere.
export const PANEL_LUGARES = {
  /** Ancho en px: al encuadrar, el mapa deja este espacio libre. */
  anchoPx: 440,
  /** Clase del ancho de la barra (440 px). */
  ancho: "w-110",
  /** Posición de lo que va a su lado: 440 px + 20 px de margen. */
  aSuLado: "right-115",
} as const;
