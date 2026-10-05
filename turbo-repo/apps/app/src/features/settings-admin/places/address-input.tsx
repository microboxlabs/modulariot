"use client";

// Campo de dirección con sugerencias (Mapbox Geocoding). Busca 300 ms después
// de dejar de escribir y cancela la búsqueda anterior.
import { useEffect, useState, type KeyboardEvent } from "react";
import { twMerge } from "tailwind-merge";
import { buscarDirecciones, type Sugerencia } from "./geocoding";
import { inputCls } from "./form-ui";
import type { LatLon } from "./places.types";

const ESPERA_MS = 300;

export type Extremo = { texto: string; punto: LatLon | null };

export default function AddressInput({
  label,
  letra,
  colorCls,
  value,
  token,
  cerca,
  onTexto,
  onElegir,
}: {
  label: string;
  /** "A" / "B": mismo distintivo que el marcador en el mapa. */
  letra: string;
  colorCls: string;
  value: Extremo;
  token: string | undefined;
  /** Centro del mapa al buscar, para priorizar resultados cercanos. */
  cerca: () => LatLon | null;
  /** El texto cambió: la dirección elegida deja de valer. */
  onTexto: (texto: string) => void;
  onElegir: (s: Sugerencia) => void;
}) {
  const [sugerencias, setSugerencias] = useState<Sugerencia[]>([]);
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
          setSugerencias(xs);
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

  const elegir = (s: Sugerencia) => {
    onElegir(s);
    setAbierto(false);
    setSugerencias([]);
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
        <span
          className={twMerge(
            "flex h-6 w-6 flex-none items-center justify-center rounded-full text-[11px] font-bold text-white",
            colorCls
          )}
          aria-hidden
        >
          {letra}
        </span>
        <input
          className={inputCls}
          placeholder={`${label}: calle, número, comuna…`}
          aria-label={label}
          role="combobox"
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
          role="listbox"
          className="absolute right-0 left-8 z-50 mt-1 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-xl dark:border-gray-700 dark:bg-gray-800"
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
                <span className="block truncate text-sm text-gray-900 dark:text-white">
                  {s.nombre}
                </span>
                {s.contexto && (
                  <span className="block truncate text-[11px] text-gray-500 dark:text-gray-400">
                    {s.contexto}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
