"use client";

// "Capas" bajo el notch del mapa: columna de botones de
// ícono que se encienden y apagan para lo que se dibuja (vehículos,
// geocercas con su nombre, trayectos). La elección se recuerda en este
// navegador.
import { useEffect, useState } from "react";
import type { IconType } from "react-icons";
import { TbPolygon, TbRoute, TbTruck } from "react-icons/tb";
import { twMerge } from "tailwind-merge";
import { useOutThenIn } from "./places-overlay/panel-motion";
import { z } from "zod";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import type { GeographicMapViewId } from "../profiles/geographic-profile-context";

export type CapaMapa = "vehiculos" | "geocercas" | "trayectos";
export type CapasMapa = Record<CapaMapa, boolean>;

const CLAVE = "geographic-view:capas";
/** la elección del botón "Geocercas" que había antes de esta barra */
const CLAVE_ANTERIOR = "geographic-view:ver-geocercas";

export const CAPAS_POR_DEFECTO: CapasMapa = {
  vehiculos: true,
  geocercas: true,
  trayectos: true,
};

const ICONOS: Record<CapaMapa, IconType> = {
  vehiculos: TbTruck,
  geocercas: TbPolygon,
  trayectos: TbRoute,
};

/** lo guardado: solo las capas conocidas (lo de versiones viejas se ignora) */
const capasGuardadas = z
  .object({
    vehiculos: z.boolean(),
    geocercas: z.boolean(),
    trayectos: z.boolean(),
  })
  .partial();

function leer(): CapasMapa {
  try {
    const guardado = globalThis.localStorage?.getItem(CLAVE);
    if (guardado) {
      const r = capasGuardadas.safeParse(JSON.parse(guardado));
      return r.success
        ? { ...CAPAS_POR_DEFECTO, ...r.data }
        : CAPAS_POR_DEFECTO;
    }
    if (globalThis.localStorage?.getItem(CLAVE_ANTERIOR) === "0") {
      return { ...CAPAS_POR_DEFECTO, geocercas: false };
    }
  } catch {
    // sin almacenamiento o dato roto: lo de siempre
  }
  return CAPAS_POR_DEFECTO;
}

/** Todas visibles por defecto; recuerda la última elección del usuario. */
export function useCapasMapa(): [
  CapasMapa,
  (capa: CapaMapa, ver: boolean) => void,
] {
  const [capas, setCapas] = useState(CAPAS_POR_DEFECTO);
  useEffect(() => setCapas(leer()), []);
  const cambiar = (capa: CapaMapa, ver: boolean) => {
    setCapas((prev) => {
      const next = { ...prev, [capa]: ver };
      try {
        globalThis.localStorage?.setItem(CLAVE, JSON.stringify(next));
      } catch {
        // sin almacenamiento: vale solo para esta visita
      }
      return next;
    });
  };
  return [capas, cambiar];
}

/**
 * Lo que tiene sentido apagar en cada vista: la general no dibuja trayectos
 * y Lugares no muestra vehículos.
 */
export function capasDeVista(vista: GeographicMapViewId | null): CapaMapa[] {
  return vista === "places"
    ? ["geocercas", "trayectos"]
    : ["vehiculos", "geocercas"];
}

/**
 * Forma del fondo azul de una capa encendida según sus vecinas: sola, un
 * círculo; seguida de otras encendidas, se unen como un button group (sin
 * redondeo entre ellas) y solo se redondean los extremos del bloque.
 */
export function formaCapa(arribaActiva: boolean, abajoActiva: boolean): string {
  if (arribaActiva && abajoActiva) return "rounded-none";
  if (arribaActiva) return "rounded-none rounded-b-full";
  if (abajoActiva) return "rounded-none rounded-t-full";
  return "rounded-full";
}

/** Siempre en este orden, en todas las vistas. */
const ORDEN_CAPAS: CapaMapa[] = ["vehiculos", "geocercas", "trayectos"];

const TRANSICION = "duration-200 ease-out motion-reduce:transition-none";
/** Fundido rápido al cambiar de vista: 75 ms de salida y 75 ms de entrada. */
const FUNDIDO_MS = 75;
const FUNDIDO = "duration-75 ease-out motion-reduce:transition-none";

function BotonCapa({
  capa,
  dict,
  activa,
  forma,
  onCambiar,
}: Readonly<{
  capa: CapaMapa;
  dict: I18nRecord;
  activa: boolean;
  /** redondeo del fondo azul (formaCapa) */
  forma: string;
  onCambiar: (capa: CapaMapa, ver: boolean) => void;
}>) {
  const Icono = ICONOS[capa];
  const nombre = tr(`geographic_view.layers.${capa}`, dict);
  return (
    // como un ítem del notch: círculo de 40 px y su nombre en una píldora
    // a la izquierda al pasar el mouse
    <div data-capa={capa} className="group relative h-10 w-10">
      <span
        aria-hidden
        className={twMerge(
          "absolute top-0 right-full z-20 mr-2 flex h-10 items-center rounded-full px-3",
          "text-sm font-medium whitespace-nowrap",
          "border border-gray-200 bg-white text-gray-900 shadow-lg",
          "dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100",
          "pointer-events-none translate-x-2 opacity-0 transition duration-200 ease-out",
          "group-has-focus-visible:translate-x-0 group-has-focus-visible:opacity-100 group-hover:translate-x-0 group-hover:opacity-100"
        )}
      >
        {nombre}
      </span>
      <button
        type="button"
        aria-pressed={activa}
        aria-label={nombre}
        onClick={() => onCambiar(capa, !activa)}
        className={twMerge(
          "relative z-10 flex h-10 w-10 items-center justify-center rounded-full transition-[color,background-color,border-radius] focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-300 dark:focus-visible:ring-blue-800",
          TRANSICION,
          activa
            ? "bg-blue-600 text-white hover:bg-blue-700"
            : "text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-white",
          activa && forma
        )}
      >
        <Icono className="h-5 w-5" />
      </button>
    </div>
  );
}

/**
 * Si la vecina visible de arriba (paso -1) o de abajo (+1) está encendida:
 * las ocultas no cuentan, así el bloque azul se une solo con lo que se ve.
 */
function vecinaEncendida(
  capas: CapasMapa,
  visibles: CapaMapa[],
  capa: CapaMapa,
  paso: -1 | 1
): boolean {
  const vecina = visibles[visibles.indexOf(capa) + paso];
  return vecina === undefined ? false : capas[vecina];
}

export default function MapLayersCard({
  dict,
  capas,
  disponibles,
  onCambiar,
}: Readonly<{
  dict: I18nRecord;
  capas: CapasMapa;
  /** las capas que tienen sentido en la vista actual */
  disponibles: CapaMapa[];
  onCambiar: (capa: CapaMapa, ver: boolean) => void;
}>) {
  // al cambiar de vista la píldora se desvanece, cambia sus botones sin que
  // se vea y vuelve a aparecer: nada se pliega ni salta de lugar
  const clave = ORDEN_CAPAS.filter((c) => disponibles.includes(c)).join(",");
  const { shown, visible } = useOutThenIn(clave, FUNDIDO_MS);
  const visibles = (shown ? shown.split(",") : []) as CapaMapa[];
  return (
    <section aria-label={tr("geographic_view.layers.title", dict)}>
      {/* misma píldora que el notch de arriba */}
      <div
        data-capas-visible={visible ? "in" : "out"}
        className={twMerge(
          "pointer-events-auto flex flex-col rounded-full border border-gray-200 bg-white/95 p-0.5 shadow-lg backdrop-blur transition-opacity dark:border-gray-700 dark:bg-gray-800/95",
          FUNDIDO,
          visible ? "opacity-100" : "pointer-events-none opacity-0"
        )}
      >
        {visibles.map((capa) => (
          <BotonCapa
            key={capa}
            capa={capa}
            dict={dict}
            activa={capas[capa]}
            forma={formaCapa(
              vecinaEncendida(capas, visibles, capa, -1),
              vecinaEncendida(capas, visibles, capa, 1)
            )}
            onCambiar={onCambiar}
          />
        ))}
      </div>
    </section>
  );
}
