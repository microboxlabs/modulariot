"use client";

// Marco de los controles de un mapa: una capa encima del mapa con un solo
// padding (20 px) y una esquina para cada grupo de controles. Así todos
// quedan a la misma distancia del borde. La barra de Lugares va al lado del
// mapa (no encima): al abrirse el mapa se angosta y estos controles se
// mueven con su borde, en el mismo movimiento.
import type { ReactNode } from "react";
import { twMerge } from "tailwind-merge";

/**
 * La esquina no toma el mouse (su caja incluye huecos: opciones plegadas,
 * espacio para desplegar): solo los controles de adentro lo hacen, así el
 * mapa se puede arrastrar alrededor de ellos.
 */
const ESQUINA = "pointer-events-none absolute flex flex-col gap-2";

export default function MapControlsFrame({
  topLeft,
  topCenter,
  topRight,
  bottomLeft,
  bottomRight,
  className,
}: Readonly<{
  topLeft?: ReactNode;
  /** Centrado arriba: avisos y datos del mapa (no botones de esquina). */
  topCenter?: ReactNode;
  topRight?: ReactNode;
  bottomLeft?: ReactNode;
  bottomRight?: ReactNode;
  /** Para mapas con capas propias encima (p. ej. un z mayor). */
  className?: string;
}>) {
  return (
    <div
      data-map-controls
      className={twMerge(
        "pointer-events-none absolute inset-0 z-50 p-5",
        className
      )}
    >
      <div className="relative h-full w-full">
        {topLeft && (
          <div className={twMerge(ESQUINA, "top-0 left-0 items-start")}>
            {topLeft}
          </div>
        )}
        {topCenter && (
          <div
            className={twMerge(
              ESQUINA,
              "top-0 left-1/2 -translate-x-1/2 items-center"
            )}
          >
            {topCenter}
          </div>
        )}
        {topRight && (
          <div className={twMerge(ESQUINA, "top-0 right-0 items-end")}>
            {topRight}
          </div>
        )}
        {bottomLeft && (
          <div className={twMerge(ESQUINA, "bottom-0 left-0 items-start")}>
            {bottomLeft}
          </div>
        )}
        {bottomRight && (
          <div className={twMerge(ESQUINA, "right-0 bottom-0 items-end")}>
            {bottomRight}
          </div>
        )}
      </div>
    </div>
  );
}
