import type { CSSProperties } from "react";

// Lugares abierto en el mapa: la línea de tiempo se pliega y el mapa
// toma todo el ancho
export function lugaresLayout(
  lugaresAbierto: boolean,
  anchos: { side: string; map: string; minSide?: string }
): { sideStyle: CSSProperties; mapWidth: string } {
  if (lugaresAbierto) {
    return {
      sideStyle: {
        width: "0%",
        marginRight: "0px",
        opacity: 0,
        borderWidth: 0,
        minWidth: 0,
      },
      mapWidth: "100%",
    };
  }
  return {
    sideStyle: {
      width: anchos.side,
      marginRight: "8px",
      opacity: 1,
      borderWidth: 1,
      // Leave room for the margin even when the viewport (or browser zoom)
      // makes the available content area narrower than the preferred minimum.
      minWidth: anchos.minSide ? `min(${anchos.minSide}, calc(100% - 8px))` : 0,
    },
    mapWidth: anchos.map,
  };
}
