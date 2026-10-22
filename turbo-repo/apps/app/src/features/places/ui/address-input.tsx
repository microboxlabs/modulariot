"use client";

// Campo de dirección o Plus Code con sugerencias (Mapbox Geocoding). Busca 300 ms después
// de dejar de escribir y cancela la búsqueda anterior.
import { useEffect, useId, useMemo, useState, type KeyboardEvent } from "react";
import { HiOutlineLocationMarker } from "react-icons/hi";
import { twMerge } from "tailwind-merge";
import { buscarDirecciones, type Sugerencia } from "../data/geocoding";
import { inputCls, inputErrorCls } from "./form-ui";
import { opcionesGeocerca } from "../routes/geofence-options";
import type { LatLon, Lugar } from "../places.types";

const ESPERA_MS = 300;

export type Extremo = { texto: string; punto: LatLon | null };

function textoAyuda(label: string, conGeocercas: boolean): string {
  if (conGeocercas) return `${label}: geocerca, dirección o Plus Code…`;
  return `${label}: dirección o Plus Code…`;
}

/** Una fila de la lista: una geocerca lleva su icono y la etiqueta. */
function OpcionSugerencia({
  sugerencia: s,
}: Readonly<{ sugerencia: Sugerencia }>) {
  const contexto = s.geocerca
    ? ["Geocerca", s.contexto].filter(Boolean).join(" · ")
    : s.contexto;
  return (
    <span className="flex items-center gap-2">
      {s.geocerca && (
        <HiOutlineLocationMarker
          className="h-4 w-4 flex-none text-blue-600"
          aria-hidden
        />
      )}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm text-gray-900 dark:text-white">
          {s.nombre}
        </span>
        {contexto && (
          <span className="block truncate text-[11px] text-gray-500 dark:text-gray-400">
            {contexto}
          </span>
        )}
      </span>
    </span>
  );
}

export default function AddressInput({
  label,
  letra,
  colorCls,
  value,
  token,
  cerca,
  onTexto,
  onElegir,
  placeholder,
  invalido = false,
  geocercas,
}: Readonly<{
  label: string;
  /** "A" / "B": mismo distintivo que el marcador en el mapa. */
  letra?: string;
  colorCls?: string;
  value: Extremo;
  token: string | undefined;
  /** Centro del mapa al buscar, para priorizar resultados cercanos. */
  cerca: () => LatLon | null;
  /** El texto cambió: la dirección elegida deja de valer. */
  onTexto: (texto: string) => void;
  onElegir: (s: Sugerencia) => void;
  placeholder?: string;
  invalido?: boolean;
  /** Geocercas guardadas que también se pueden elegir, sobre las direcciones. */
  geocercas?: Lugar[];
}>) {
  const idLista = useId();
  const [direcciones, setDirecciones] = useState<Sugerencia[]>([]);
  const [activa, setActiva] = useState(0);
  const [abierto, setAbierto] = useState(false);

  // con una dirección ya elegida no se busca hasta que se edite el texto
  const buscar = abierto && !value.punto && !!token;
  useEffect(() => {
    if (!buscar || !token) return;
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      void buscarDirecciones(value.texto, token, cerca(), ctrl.signal).then(
        (xs) => {
          setDirecciones(xs);
          setActiva(0);
        }
      );
    }, ESPERA_MS);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
    // `cerca` se lee al momento de buscar; no debe re-disparar la búsqueda
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buscar, value.texto, token]);

  // primero las geocercas que calzan (todas al abrir sin texto), luego
  // las direcciones de Mapbox
  const sugerencias = useMemo(
    () => [
      ...(geocercas ? opcionesGeocerca(geocercas, value.texto) : []),
      ...direcciones,
    ],
    [geocercas, value.texto, direcciones]
  );

  const elegir = (s: Sugerencia) => {
    onElegir(s);
    setAbierto(false);
    setDirecciones([]);
  };

  const alPresionar = (e: KeyboardEvent<HTMLInputElement>) => {
    if (!abierto || sugerencias.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiva((i) => Math.min(i + 1, sugerencias.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiva((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const s = sugerencias[activa];
      if (s) elegir(s);
    } else if (e.key === "Escape") {
      setAbierto(false);
    }
  };

  const mostrarLista = abierto && sugerencias.length > 0 && !value.punto;

  return (
    <div className="relative">
      <div className="flex items-center gap-2">
        {letra && (
          <span
            className={twMerge(
              "flex h-6 w-6 flex-none items-center justify-center rounded-full text-[11px] font-bold text-white",
              colorCls
            )}
            aria-hidden
          >
            {letra}
          </span>
        )}
        <input
          className={twMerge(inputCls, invalido && inputErrorCls)}
          placeholder={placeholder ?? textoAyuda(label, !!geocercas)}
          aria-label={label}
          aria-invalid={invalido}
          role="combobox"
          aria-controls={idLista}
          aria-expanded={mostrarLista}
          aria-autocomplete="list"
          value={value.texto}
          onChange={(e) => {
            onTexto(e.target.value);
            setAbierto(true);
          }}
          onFocus={() => setAbierto(true)}
          // el mousedown de una sugerencia corre antes que este blur
          onBlur={() => setAbierto(false)}
          onKeyDown={alPresionar}
        />
      </div>
      {mostrarLista && (
        <ul
          id={idLista}
          role="listbox"
          className={twMerge(
            "absolute right-0 z-50 mt-1 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-xl dark:border-gray-700 dark:bg-gray-800",
            letra ? "left-8" : "left-0"
          )}
        >
          {sugerencias.map((s, i) => (
            <li key={s.id} role="option" aria-selected={i === activa}>
              <button
                type="button"
                // mousedown para elegir antes de que el input pierda el foco
                onMouseDown={(e) => {
                  e.preventDefault();
                  elegir(s);
                }}
                onMouseEnter={() => setActiva(i)}
                className={twMerge(
                  "block w-full px-3 py-1.5 text-left",
                  i === activa && "bg-gray-100 dark:bg-gray-700"
                )}
              >
                <OpcionSugerencia sugerencia={s} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
