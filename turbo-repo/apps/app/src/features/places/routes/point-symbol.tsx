// Símbolos de los puntos intermedios del recorrido, iguales en la lista y en
// el mapa: una parada es un "PARE" (octágono rojo con su número) y un desvío
// es un círculo hueco (la ruta solo pasa por ahí).
import { twMerge } from "tailwind-merge";

const OCTAGONO =
  "polygon(30% 0, 70% 0, 100% 30%, 100% 70%, 70% 100%, 30% 100%, 0 70%, 0 30%)";

/** Octágono rojo con borde blanco y el número de la parada. */
export function SimboloParada({
  numero,
  className,
}: Readonly<{
  numero: string;
  className?: string;
}>) {
  return (
    <span
      aria-hidden
      className={twMerge("relative block h-6 w-6 bg-white shadow", className)}
      style={{ clipPath: OCTAGONO }}
    >
      <span
        className="absolute inset-[2px] flex items-center justify-center bg-red-600 text-[10px] font-bold text-white"
        style={{ clipPath: OCTAGONO }}
      >
        {numero}
      </span>
    </span>
  );
}

/** Círculo hueco: punto de paso, sin número. */
export function SimboloDesvio({ className }: Readonly<{ className?: string }>) {
  return (
    <span
      aria-hidden
      className={twMerge(
        "block h-4 w-4 rounded-full border-2 border-blue-600 bg-white shadow",
        className
      )}
    />
  );
}
