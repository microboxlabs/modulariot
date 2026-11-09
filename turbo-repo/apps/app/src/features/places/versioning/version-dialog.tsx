"use client";

// Al guardar una geocerca o un trayecto editado: qué cambió, de qué tamaño
// es la actualización (con la recomendada marcada), la versión que queda y
// una descripción para el historial. Como el diálogo de publicar síntomas.
import { useEffect, useRef, useState } from "react";
import {
  autoUpdate,
  flip,
  FloatingFocusManager,
  FloatingPortal,
  offset,
  shift,
  size,
  useClick,
  useDismiss,
  useFloating,
  useInteractions,
  useListNavigation,
  useRole,
} from "@floating-ui/react";
import { Button, Label, Textarea } from "flowbite-react";
import AbsoluteModal from "@/features/common/components/absolute-modal/absolute-modal";
import { HiChevronDown } from "react-icons/hi";
import {
  dropdownDefaultBorderClass,
  dropdownTriggerBaseClass,
} from "@/features/symptoms/components/map-view/prototype/prototype-form-kit";
import { BumpBadge } from "@/features/symptoms/maintainer/ui/badges";
import {
  bumpRecomendado,
  nextVersion,
  type CambioVersion,
  type VersionBump,
} from "./versioning";
import {
  usePlacesT,
  type ClaveLugares,
  type TextosLugares,
} from "../i18n/places-i18n";

/** Textos de BumpBadge, en el idioma de la página. */
const dictBump = (t: TextosLugares) => ({
  bumpMajor: t("versioning.bump_major"),
  bumpMinor: t("versioning.bump_minor"),
  bumpPatch: t("versioning.bump_patch"),
});

const TAMANOS: {
  bump: VersionBump;
  nombre: ClaveLugares;
  por: ClaveLugares;
}[] = [
  {
    bump: "MAJOR",
    nombre: "versioning.size_major",
    por: "versioning.size_major_why",
  },
  {
    bump: "MINOR",
    nombre: "versioning.size_minor",
    por: "versioning.size_minor_why",
  },
  {
    bump: "PATCH",
    nombre: "versioning.size_patch",
    por: "versioning.size_patch_why",
  },
];

export type VersionPendiente = {
  nombre: string;
  /** "geocerca" o "trayecto", para los textos */
  que: string;
  actual: string;
  cambios: CambioVersion[];
};

/** Una opción del tipo de actualización: nombre, versión que deja y por qué. */
function DetalleTamano({
  nombre,
  por,
  version,
  recomendado,
}: Readonly<{
  nombre: string;
  por?: string;
  version: string;
  recomendado: boolean;
}>) {
  const t = usePlacesT();
  return (
    <span className="flex min-w-0 flex-1 flex-col text-left">
      <span className="flex items-center gap-2">
        <span className="font-semibold text-gray-900 dark:text-white">
          {nombre}
        </span>
        <span className="font-mono text-gray-600 dark:text-gray-300">
          {version}
        </span>
        {recomendado && (
          <span className="rounded bg-blue-600 px-1.5 text-[10px] font-semibold text-white">
            {t("versioning.recommended")}
          </span>
        )}
      </span>
      {por && (
        <span className="text-[11px] text-gray-500 dark:text-gray-400">
          {por}
        </span>
      )}
    </span>
  );
}

/**
 * Tipo de actualización en un desplegable, como los del resto del sistema. El
 * menú va en un portal sobre el modal (no el Dropdown de Flowbite, que lo deja
 * dentro y el contenido con scroll del modal lo corta).
 */
function TamanoDropdown({
  actual,
  bump,
  recomendado,
  onElegir,
}: Readonly<{
  actual: string;
  bump: VersionBump;
  recomendado: VersionBump | null;
  onElegir: (b: VersionBump) => void;
}>) {
  const tx = usePlacesT();
  const [abierto, setAbierto] = useState(false);
  const { refs, floatingStyles, context } = useFloating({
    open: abierto,
    onOpenChange: setAbierto,
    placement: "bottom-start",
    middleware: [
      offset(4),
      flip({ padding: 8 }),
      shift({ padding: 8 }),
      size({
        padding: 8,
        apply({ rects, availableHeight, elements }) {
          elements.floating.style.width = `${rects.reference.width}px`;
          elements.floating.style.maxHeight = `${Math.min(availableHeight, 240)}px`;
        },
      }),
    ],
    whileElementsMounted: autoUpdate,
  });
  const [activo, setActivo] = useState<number | null>(null);
  const opcionesRef = useRef<Array<HTMLElement | null>>([]);
  const { getReferenceProps, getFloatingProps, getItemProps } = useInteractions(
    [
      useClick(context),
      useDismiss(context),
      useRole(context, { role: "menu" }),
      useListNavigation(context, {
        listRef: opcionesRef,
        activeIndex: activo,
        selectedIndex: TAMANOS.findIndex((t) => t.bump === bump),
        onNavigate: setActivo,
        loop: true,
      }),
    ]
  );
  // Escape con el foco en el botón cierra solo el menú: el modal escucha sus
  // teclas en el propio diálogo, así que se corta antes de que llegue ahí
  useEffect(() => {
    const boton = refs.domReference.current;
    if (!abierto || !(boton instanceof HTMLElement)) return;
    const soloElMenu = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      setAbierto(false);
    };
    boton.addEventListener("keydown", soloElMenu);
    return () => boton.removeEventListener("keydown", soloElMenu);
  }, [abierto, refs.domReference]);
  const elegido = TAMANOS.find((t) => t.bump === bump) ?? TAMANOS[0]!;
  const elegir = (b: VersionBump) => {
    setAbierto(false);
    onElegir(b);
  };
  return (
    <>
      <button
        type="button"
        ref={refs.setReference}
        {...getReferenceProps()}
        // después de las props del menú, que traen su propio id: el Label la nombra por este
        id="version-tipo"
        className={`${dropdownTriggerBaseClass} ${dropdownDefaultBorderClass}`}
      >
        <DetalleTamano
          nombre={tx(elegido.nombre)}
          version={nextVersion(actual, elegido.bump)}
          recomendado={recomendado === elegido.bump}
        />
        <HiChevronDown className="h-3.5 w-3.5 shrink-0 text-gray-400" />
      </button>
      {abierto && (
        <FloatingPortal>
          {/* lleva el foco al menú y lo devuelve al botón al cerrarse */}
          <FloatingFocusManager context={context} modal={false}>
            <div
              ref={refs.setFloating}
              style={floatingStyles}
              {...getFloatingProps()}
              className="z-900 overflow-y-auto rounded-lg border border-gray-200 bg-white py-1 text-xs shadow-lg dark:border-gray-600 dark:bg-gray-700"
            >
              {TAMANOS.map((t, i) => (
                <button
                  key={t.bump}
                  type="button"
                  role="menuitem"
                  ref={(nodo) => {
                    opcionesRef.current[i] = nodo;
                  }}
                  tabIndex={activo === i ? 0 : -1}
                  {...getItemProps({ onClick: () => elegir(t.bump) })}
                  className={`flex w-full cursor-pointer items-center px-4 py-2 hover:bg-gray-100 focus:bg-gray-100 focus:outline-none dark:hover:bg-gray-600 dark:focus:bg-gray-600 ${t.bump === bump ? "bg-gray-100 dark:bg-gray-600" : ""}`}
                >
                  <DetalleTamano
                    nombre={tx(t.nombre)}
                    por={tx(t.por)}
                    version={nextVersion(actual, t.bump)}
                    recomendado={recomendado === t.bump}
                  />
                </button>
              ))}
            </div>
          </FloatingFocusManager>
        </FloatingPortal>
      )}
    </>
  );
}

export default function VersionDialog({
  pendiente,
  guardando,
  onCancelar,
  onConfirmar,
}: Readonly<{
  pendiente: VersionPendiente | null;
  guardando?: boolean;
  onCancelar: () => void;
  onConfirmar: (bump: VersionBump, descripcion: string) => void;
}>) {
  const t = usePlacesT();
  const recomendado = pendiente ? bumpRecomendado(pendiente.cambios) : null;
  const [bump, setBump] = useState<VersionBump>("PATCH");
  const [descripcion, setDescripcion] = useState("");

  // cada vez que se abre: la recomendada elegida y sin descripción
  useEffect(() => {
    if (!pendiente) return;
    setBump(recomendado ?? "PATCH");
    setDescripcion("");
  }, [pendiente, recomendado]);

  if (!pendiente) return null;
  const destino = nextVersion(pendiente.actual, bump);
  const DICT_BUMP = dictBump(t);
  const titulo = t("versioning.dialog_title", {
    que: pendiente.que,
    nombre: pendiente.nombre,
  });

  return (
    <AbsoluteModal
      selected={pendiente}
      setSelected={onCancelar}
      ariaLabel={titulo}
      maxWidth="36rem"
      maxHeight="92vh"
      className="w-full rounded-2xl border border-gray-200 bg-white text-left text-gray-900 shadow-2xl dark:border-gray-700 dark:bg-gray-800 dark:text-white"
    >
      <div className="flex min-h-0 w-full flex-col">
        <div className="shrink-0 border-b border-gray-200 px-6 py-4 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            {titulo}
          </h2>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-sm">
            <span className="font-mono text-gray-500 dark:text-gray-400">
              {pendiente.actual}
            </span>
            <span aria-hidden className="text-gray-400">
              →
            </span>
            <span className="font-mono font-semibold">{destino}</span>
            <BumpBadge bump={bump} d={DICT_BUMP} />
          </p>
        </div>
        <div className="flex min-h-0 flex-col gap-4 overflow-y-auto px-6 py-5">
          <div>
            <p className="mb-2 flex items-center justify-between text-xs font-semibold text-gray-500 uppercase dark:text-gray-400">
              {t("versioning.changes")}
              <span className="rounded-full bg-gray-200 px-1.5 py-px text-[10px] font-medium text-gray-700 normal-case dark:bg-gray-600 dark:text-gray-200">
                {pendiente.cambios.length}
              </span>
            </p>
            {/* tope de ~4 cambios y scroll propio: muchos no estiran el modal */}
            <ul
              aria-label={t("versioning.changes")}
              className="max-h-40 divide-y divide-gray-100 overflow-y-auto overscroll-contain rounded-lg border border-gray-200 text-sm text-gray-700 dark:divide-gray-700 dark:border-gray-700 dark:text-gray-300"
            >
              {pendiente.cambios.map((c) => (
                <li key={c.texto} className="flex items-start gap-2 px-3 py-2">
                  <BumpBadge bump={c.bump} d={DICT_BUMP} className="mt-0.5" />
                  <span>{c.texto}</span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <Label htmlFor="version-tipo">{t("versioning.update_type")}</Label>
            <TamanoDropdown
              actual={pendiente.actual}
              bump={bump}
              recomendado={recomendado}
              onElegir={setBump}
            />
          </div>
          <div>
            <Label htmlFor="version-descripcion">
              {t("versioning.description")}
            </Label>
            <Textarea
              id="version-descripcion"
              rows={3}
              maxLength={500}
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              placeholder={t("versioning.description_placeholder")}
            />
          </div>
        </div>
        <div className="flex shrink-0 justify-end gap-2 border-t border-gray-200 px-6 py-3 dark:border-gray-700">
          <Button color="alternative" onClick={onCancelar}>
            {t("common.cancel")}
          </Button>
          <Button
            color="blue"
            disabled={guardando || !descripcion.trim()}
            onClick={() => onConfirmar(bump, descripcion.trim())}
          >
            {t("versioning.save_version", { version: destino })}
          </Button>
        </div>
      </div>
    </AbsoluteModal>
  );
}
