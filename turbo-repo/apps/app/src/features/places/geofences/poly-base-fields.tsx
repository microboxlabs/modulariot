"use client";

import {
  useId,
  useRef,
  type ChangeEvent,
  type MouseEvent,
  type PointerEvent,
} from "react";
import { HiLink } from "react-icons/hi";
import { twMerge } from "tailwind-merge";
import { RECT_MAX, RECT_MIN, normalizarPolyBase } from "./geofence-editor";

const PASO_M = 10;
const PX_POR_PASO = 4;
const UMBRAL_PX = 3;

export function acotarMetros(
  n: number,
  min = RECT_MIN,
  max = RECT_MAX
): number {
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, n));
}

/** Miles con punto: 1200 → "1.200". */
export function milesConPunto(n: number): string {
  const sign = n < 0 ? "-" : "";
  const digits = String(Math.round(Math.abs(n)));
  // de a tres desde la derecha, sin regex con retroceso
  const grupos: string[] = [];
  for (let fin = digits.length; fin > 0; fin -= 3) {
    grupos.unshift(digits.slice(Math.max(0, fin - 3), fin));
  }
  return sign + grupos.join(".");
}

/** Interpreta "1.200" o "1200" como metros. */
export function metrosDesdeTexto(texto: string): number {
  const limpio = texto.replace(/\./g, "").replace(/[^\d-]/g, "");
  if (limpio === "" || limpio === "-") return Number.NaN;
  return Number(limpio);
}

/** El navegador no deja bloquear el puntero: se arrastra sin bloqueo. */
function sinBloqueoDePuntero() {
  // nada que hacer: el arrastre usa clientX en vez de movementX
}

/** Delta en px: con lock suma movementX (sigue fuera de la pantalla). */
export function dxDelArrastre(
  a: { x: number; dx: number },
  ev: { clientX: number; movementX?: number },
  locked: boolean
): number {
  if (locked) {
    a.dx += ev.movementX || 0;
    return a.dx;
  }
  return ev.clientX - a.x;
}

/** Cuántos metros correspondan al desplazamiento horizontal del arrastre. */
export function valorDesdeArrastre(
  origen: number,
  dxPx: number,
  min = RECT_MIN,
  max = RECT_MAX
): number {
  return acotarMetros(
    origen + Math.round(dxPx / PX_POR_PASO) * PASO_M,
    min,
    max
  );
}

export function SizeInput({
  label,
  value,
  onChange,
  min = RECT_MIN,
  max = RECT_MAX,
}: Readonly<{
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
}>) {
  const idInput = useId();
  const caja = useRef<HTMLDivElement>(null);
  const arrastre = useRef<{
    x: number;
    dx: number;
    valor: number;
    activo: boolean;
    via: "pointer" | null;
  } | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const minRef = useRef(min);
  const maxRef = useRef(max);
  minRef.current = min;
  maxRef.current = max;

  const bound = useRef({
    pedirLock() {
      const el = caja.current;
      if (!el?.requestPointerLock) return;
      // los navegadores viejos devuelven undefined en vez de una promesa;
      // sin bloqueo, el arrastre sigue igual
      Promise.resolve(el.requestPointerLock()).catch(sinBloqueoDePuntero);
    },
    mover(ev: Event) {
      const a = arrastre.current;
      if (!a) return;
      const e = ev as globalThis.MouseEvent; // el del navegador, no el de React
      const locked = Boolean(document.pointerLockElement);
      if (locked && ev.type === "mousemove" && a.via === "pointer") return;
      if (ev.type === "pointermove") a.via = "pointer";
      const dx = dxDelArrastre(a, e, locked);
      if (!a.activo) {
        if (Math.abs(dx) < UMBRAL_PX) return;
        a.activo = true;
        a.dx = dx;
        bound.current.pedirLock();
      }
      onChangeRef.current(
        valorDesdeArrastre(a.valor, dx, minRef.current, maxRef.current)
      );
    },
    soltar() {
      if (document.pointerLockElement) document.exitPointerLock();
      arrastre.current = null;
      window.removeEventListener("mousemove", bound.current.mover);
      window.removeEventListener("mouseup", bound.current.soltar);
      window.removeEventListener("pointermove", bound.current.mover);
      window.removeEventListener("pointerup", bound.current.soltar);
    },
  });

  const cambiar = (e: ChangeEvent<HTMLInputElement>) => {
    if (arrastre.current) return;
    const n = metrosDesdeTexto(e.target.value);
    if (!Number.isFinite(n)) return;
    onChange(acotarMetros(n, min, max));
  };

  const empezar = (clientX: number) => {
    if (arrastre.current) return;
    arrastre.current = {
      x: clientX,
      dx: 0,
      valor: value,
      activo: false,
      via: null,
    };
    window.addEventListener("mousemove", bound.current.mover);
    window.addEventListener("mouseup", bound.current.soltar);
    window.addEventListener("pointermove", bound.current.mover);
    window.addEventListener("pointerup", bound.current.soltar);
  };

  const alPointerDown = (e: PointerEvent<HTMLElement>) => {
    if (e.button > 0) return;
    e.stopPropagation();
    empezar(e.clientX);
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };

  const alMouseDown = (e: MouseEvent<HTMLElement>) => {
    if (e.button > 0) return;
    e.stopPropagation();
    empezar(e.clientX);
  };

  return (
    // el arrastre empieza en el input (control nativo), que llena la caja
    <div
      ref={caja}
      className="flex w-full min-w-0 cursor-ew-resize select-none items-center gap-1 rounded-md border border-gray-200 bg-gray-50 px-2 py-1 dark:border-gray-600 dark:bg-gray-700/60"
      title="Arrastra para ajustar"
    >
      <label
        htmlFor={idInput}
        className="shrink-0 text-[10px] font-medium text-gray-500 dark:text-gray-400"
      >
        {label}
      </label>
      <input
        id={idInput}
        type="text"
        inputMode="numeric"
        value={milesConPunto(value)}
        aria-label={label}
        className="min-w-0 flex-1 cursor-ew-resize bg-transparent text-right text-sm tabular-nums text-gray-900 outline-none focus:cursor-text dark:text-white"
        onChange={cambiar}
        onPointerDown={alPointerDown}
        onMouseDown={alMouseDown}
      />
      <span className="shrink-0 text-[10px] text-gray-400">m</span>
    </div>
  );
}

export default function PolyBaseFields({
  anchoM,
  altoM,
  vinculado,
  onAncho,
  onAlto,
  onVincular,
}: Readonly<{
  anchoM: number;
  altoM: number;
  vinculado: boolean;
  onAncho: (value: number) => void;
  onAlto: (value: number) => void;
  onVincular: (value: boolean) => void;
}>) {
  const toggleVinculo = () => onVincular(!vinculado);

  return (
    <div className="flex items-stretch gap-1">
      <div className="min-w-0 flex-1 space-y-1">
        <SizeInput label="Ancho" value={anchoM} onChange={onAncho} />
        <SizeInput label="Alto" value={altoM} onChange={onAlto} />
      </div>
      <button
        type="button"
        aria-pressed={vinculado}
        aria-label="Vincular ancho y alto"
        title={vinculado ? "Ancho y alto vinculados" : "Vincular ancho y alto"}
        onClick={toggleVinculo}
        className={twMerge(
          "flex w-7 flex-none items-center justify-center rounded-md border",
          vinculado
            ? "border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-700 dark:bg-blue-950/50 dark:text-blue-300"
            : "border-gray-200 text-gray-400 hover:border-gray-300 hover:text-gray-700 dark:border-gray-600 dark:text-gray-500 dark:hover:text-gray-200"
        )}
      >
        <HiLink className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

export function pistaPoligono(polyBase: string, ubicado: boolean): string {
  if (normalizarPolyBase(polyBase) === "libre") {
    return "Clic en el mapa para los vértices. Cierra la figura para crear geocerca.";
  }
  if (!ubicado) return "Clic en el mapa para ubicar la forma";
  return "Ajusta el tamaño o un vértice. Editar un vértice pasa a polígono.";
}
