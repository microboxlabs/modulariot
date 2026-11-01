import type { CSSProperties } from "react";

// Lugares abierto en el mapa: la línea de tiempo se pliega y el mapa
// toma todo el ancho
export function lugaresLayout(
  lugaresAbierto: boolean,
  anchos: { side: string; map: string }
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
      minWidth: 0,
    },
    mapWidth: anchos.map,
  };
}
