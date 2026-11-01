"use client";

import { useEffect, type ReactNode } from "react";
import { Tooltip } from "flowbite-react";
import { HiCheck, HiPencil, HiX } from "react-icons/hi";
import { HiArrowUturnLeft, HiArrowUturnRight } from "react-icons/hi2";
import { KeyboardShortcutTrigger } from "@/features/common/components/keyboard-shortcut-trigger";

// Teclas dentro del formulario o sus popups (calendario, menús) no dibujan.
const ignorarTecla = (t: EventTarget | null) =>
  t instanceof HTMLElement &&
  (t.isContentEditable ||
    ["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName) ||
    !!t.closest(
      "[data-places-form],[data-places-datepicker],[role=listbox],[role=menu]"
    ));

/** Atajos globales que no aplican mientras se escribe en el formulario. */
const ignorarEvento = (e: KeyboardEvent) => ignorarTecla(e.target);

// bloque de botones unidos: borde común y separadores finos
const grupoCls =
  "flex overflow-hidden rounded-md border border-gray-200 dark:border-gray-600";
const separadorCls = "w-px bg-gray-200 dark:bg-gray-600";

const esMac = () =>
  typeof navigator !== "undefined" &&
  /Mac|iPhone|iPad/.test(navigator.platform);

function AtajoTooltip({
  label,
  tecla,
}: Readonly<{ label: string; tecla: string }>) {
  return (
    <span className="whitespace-nowrap">
      {label} <span className="opacity-60">· {tecla}</span>
    </span>
  );
}

/** Botón compacto con icono y texto; el atajo va en el tooltip de Flowbite. */
function BotonAccion({
  label,
  texto,
  tecla,
  disabled,
  onClick,
  className,
  children,
}: Readonly<{
  label: string;
  /** Texto visible del botón (corto). */
  texto: string;
  tecla: string;
  disabled?: boolean;
  onClick: () => void;
  className: string;
  children: ReactNode;
}>) {
  return (
    <Tooltip
      content={<AtajoTooltip label={label} tecla={tecla} />}
      placement="top"
    >
      <button
        type="button"
        aria-label={`${label} (${tecla})`}
        disabled={disabled}
        onClick={onClick}
        className={`flex h-7 items-center gap-1 px-2 text-xs font-medium disabled:cursor-not-allowed disabled:opacity-40 ${className}`}
      >
        {children}
        {texto}
      </button>
    </Tooltip>
  );
}

/** Par deshacer/rehacer: dos botones de icono unidos en un solo bloque. */
function GrupoHistorial({
  puedeDeshacer,
  puedeRehacer,
  onDeshacer,
  onRehacer,
}: Readonly<{
  puedeDeshacer: boolean;
  puedeRehacer: boolean;
  onDeshacer: () => void;
  onRehacer: () => void;
}>) {
  const mod = esMac() ? "⌘" : "Ctrl+";
  const btn =
    "flex h-7 w-7 items-center justify-center text-gray-700 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent dark:text-gray-200 dark:hover:bg-gray-700";
  // Mismo componente que el botón del harness: al mantener ⌘/Ctrl aparece
  // la tecla sobre el botón, y el atajo lo dispara. Sin overflow-hidden en
  // el grupo para que esa marca no se recorte.
  return (
    <fieldset
      aria-label="Historial"
      className="min-w-0 flex rounded-md border border-gray-200 dark:border-gray-600"
    >
      <KeyboardShortcutTrigger
        shortcutKey="z"
        label="Z"
        shift={false}
        ignore={ignorarEvento}
        enabled={puedeDeshacer}
        onTrigger={onDeshacer}
      >
        <Tooltip
          content={<AtajoTooltip label="Deshacer" tecla={`${mod}Z`} />}
          placement="top"
        >
          <button
            type="button"
            aria-label="Deshacer (⌫)"
            disabled={!puedeDeshacer}
            onClick={onDeshacer}
            className={`${btn} rounded-l-md`}
          >
            <HiArrowUturnLeft className="h-3.5 w-3.5" />
          </button>
        </Tooltip>
      </KeyboardShortcutTrigger>
      <span className={separadorCls} />
      <KeyboardShortcutTrigger
        shortcutKey="z"
        label="⇧Z"
        shift
        ignore={ignorarEvento}
        enabled={puedeRehacer}
        onTrigger={onRehacer}
      >
        <Tooltip
          content={<AtajoTooltip label="Rehacer" tecla={`${mod}⇧Z`} />}
          placement="top"
        >
          <button
            type="button"
            aria-label="Rehacer"
            disabled={!puedeRehacer}
            onClick={onRehacer}
            className={`${btn} rounded-r-md`}
          >
            <HiArrowUturnRight className="h-3.5 w-3.5" />
          </button>
        </Tooltip>
      </KeyboardShortcutTrigger>
    </fieldset>
  );
}

// Textos de la barra según qué se dibuja; el acento es el azul del sistema.
const terminarCls = "bg-blue-600 text-white hover:bg-blue-700";
const seguirCls =
  "text-blue-700 hover:bg-blue-50 dark:text-blue-300 dark:hover:bg-blue-900/30";

const VARIANTES = {
  poligono: {
    aria: "Edición de polígono",
    terminar: "Cerrar",
    terminarLabel: "Cerrar (unir con el inicio)",
    terminarMin: "Cerrar (mín. 3 puntos)",
    seguir: "Seguir dibujando",
    seguirTecla: "clic en el mapa agrega puntos",
    cancelarLabel: "Cancelar dibujo",
  },
  trayecto: {
    aria: "Edición de recorrido",
    terminar: "Listo",
    terminarLabel: "Confirmar recorrido y trazar la ruta",
    terminarMin: "Confirmar (ubica origen y destino)",
    seguir: "Editar puntos",
    seguirTecla: "arrastra puntos o el medio de un tramo",
    cancelarLabel: "Borrar recorrido",
  },
};

/**
 * Barra sobre el mapa al editar un polígono o un recorrido. Dibujando: terminar,
 * deshacer/rehacer o cancelar. Terminado: deshacer/rehacer y seguir dibujando. Atajos: Enter; Backspace o Cmd/Ctrl+Z;
 * Cmd/Ctrl+Shift+Z o Ctrl+Y; Esc (no cuando se escribe en el formulario).
 */
export default function PolygonDrawToolbar({
  puntos,
  cerrado,
  puedeTerminar,
  puedeDeshacer,
  puedeRehacer,
  onTerminar,
  onDeshacer,
  onRehacer,
  onCancelar,
  onSeguir,
  variante = "poligono",
}: Readonly<{
  variante?: keyof typeof VARIANTES;
  puntos: number;
  cerrado: boolean;
  puedeTerminar: boolean;
  puedeDeshacer: boolean;
  puedeRehacer: boolean;
  onTerminar: () => void;
  onDeshacer: () => void;
  onRehacer: () => void;
  onCancelar: () => void;
  onSeguir: () => void;
}>) {
  useEffect(() => {
    const accion = (e: KeyboardEvent): (() => void) | null => {
      // ⌘Z / ⌘⇧Z los manejan los botones (KeyboardShortcutTrigger)
      if (e.ctrlKey && e.key.toLowerCase() === "y") return onRehacer;
      // Backspace solo deshace mientras se dibuja; con el polígono terminado
      // una tecla suelta no debe cambiar la forma.
      if (e.key === "Backspace" && !cerrado) return onDeshacer;
      if (cerrado) return null;
      if (e.key === "Enter" && puedeTerminar) return onTerminar;
      if (e.key === "Escape") return onCancelar;
      return null;
    };
    const onKey = (e: KeyboardEvent) => {
      if (ignorarTecla(e.target)) return;
      const fn = accion(e);
      if (!fn) return;
      e.preventDefault();
      fn();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [cerrado, puedeTerminar, onTerminar, onDeshacer, onRehacer, onCancelar]);
  const v = VARIANTES[variante];

  return (
    <div
      role="toolbar"
      aria-label={v.aria}
      className="absolute bottom-5 left-1/2 z-40 flex -translate-x-1/2 items-center gap-1.5 rounded-lg border border-gray-200 bg-white/95 p-1 shadow-lg backdrop-blur dark:border-gray-700 dark:bg-gray-800/95"
    >
      <span
        className="min-w-6 px-1.5 text-center text-xs font-medium tabular-nums text-gray-500 dark:text-gray-400"
        title={`${puntos} ${puntos === 1 ? "punto" : "puntos"}`}
      >
        {puntos} pts
      </span>
      <GrupoHistorial
        puedeDeshacer={puedeDeshacer}
        puedeRehacer={puedeRehacer}
        onDeshacer={onDeshacer}
        onRehacer={onRehacer}
      />
      {cerrado ? (
        <fieldset aria-label="Edición" className={grupoCls}>
          <BotonAccion
            label={v.seguir}
            texto={v.seguir}
            tecla={v.seguirTecla}
            onClick={onSeguir}
            className={seguirCls}
          >
            <HiPencil className="h-3.5 w-3.5" />
          </BotonAccion>
        </fieldset>
      ) : (
        <fieldset aria-label="Cerrar o cancelar" className={grupoCls}>
          <BotonAccion
            label={puedeTerminar ? v.terminarLabel : v.terminarMin}
            texto={v.terminar}
            tecla="Enter"
            disabled={!puedeTerminar}
            onClick={onTerminar}
            className={terminarCls}
          >
            <HiCheck className="h-3.5 w-3.5" />
          </BotonAccion>
          <span className={separadorCls} />
          <BotonAccion
            label={v.cancelarLabel}
            texto="Cancelar"
            tecla="Esc"
            onClick={onCancelar}
            className="text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-900/30"
          >
            <HiX className="h-3.5 w-3.5" />
          </BotonAccion>
        </fieldset>
      )}
    </div>
  );
}
