"use client";

// Al guardar una geocerca o un trayecto editado: qué cambió, de qué tamaño
// es la actualización (con la recomendada marcada), la versión que queda y
// una descripción para el historial. Como el diálogo de publicar síntomas.
import { useEffect, useState } from "react";
import {
  Button,
  Dropdown,
  DropdownItem,
  Label,
  Textarea,
} from "flowbite-react";
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

/** Textos de BumpBadge (el módulo de lugares va en español). */
const DICT_BUMP = {
  bumpMajor: "MAYOR",
  bumpMinor: "MENOR",
  bumpPatch: "PARCHE",
};

const TAMANOS: { bump: VersionBump; nombre: string; por: string }[] = [
  { bump: "MAJOR", nombre: "Mayor", por: "cambia la forma o el recorrido" },
  {
    bump: "MINOR",
    nombre: "Menor",
    por: "cambian categorías, vigencia, interiores o puntos",
  },
  { bump: "PATCH", nombre: "Parche", por: "cambia el nombre u otros datos" },
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
            Recomendada
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

/** Tipo de actualización en un desplegable, como los del resto del sistema. */
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
  const elegido = TAMANOS.find((t) => t.bump === bump) ?? TAMANOS[0]!;
  return (
    <div className="relative w-full">
      <Dropdown
        label={false}
        placement="bottom-start"
        theme={{
          floating: {
            base: "z-30 max-h-60 w-full overflow-y-auto rounded-lg",
            content: "py-1 text-xs",
          },
        }}
        renderTrigger={() => (
          <button
            type="button"
            id="version-tipo"
            className={`${dropdownTriggerBaseClass} ${dropdownDefaultBorderClass}`}
          >
            <DetalleTamano
              nombre={elegido.nombre}
              version={nextVersion(actual, elegido.bump)}
              recomendado={recomendado === elegido.bump}
            />
            <HiChevronDown className="h-3.5 w-3.5 shrink-0 text-gray-400" />
          </button>
        )}
      >
        {TAMANOS.map((t) => (
          <DropdownItem
            key={t.bump}
            onClick={() => onElegir(t.bump)}
            className={t.bump === bump ? "bg-gray-100 dark:bg-gray-600" : ""}
          >
            <DetalleTamano
              nombre={t.nombre}
              por={t.por}
              version={nextVersion(actual, t.bump)}
              recomendado={recomendado === t.bump}
            />
          </DropdownItem>
        ))}
      </Dropdown>
    </div>
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

  return (
    <AbsoluteModal
      selected={pendiente}
      setSelected={onCancelar}
      ariaLabel={`Nueva versión de ${pendiente.que} «${pendiente.nombre}»`}
      maxWidth="36rem"
      maxHeight="92vh"
      className="w-full rounded-2xl border border-gray-200 bg-white text-left text-gray-900 shadow-2xl dark:border-gray-700 dark:bg-gray-800 dark:text-white"
    >
      <div className="flex min-h-0 w-full flex-col">
        <div className="shrink-0 border-b border-gray-200 px-6 py-4 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Nueva versión de {pendiente.que} «{pendiente.nombre}»
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
              {"Cambios"}
              <span className="rounded-full bg-gray-200 px-1.5 py-px text-[10px] font-medium text-gray-700 normal-case dark:bg-gray-600 dark:text-gray-200">
                {pendiente.cambios.length}
              </span>
            </p>
            {/* tope de ~4 cambios y scroll propio: muchos no estiran el modal */}
            <ul
              aria-label="Cambios"
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
            <Label htmlFor="version-tipo">Tipo de actualización</Label>
            <TamanoDropdown
              actual={pendiente.actual}
              bump={bump}
              recomendado={recomendado}
              onElegir={setBump}
            />
          </div>
          <div>
            <Label htmlFor="version-descripcion">
              Descripción (queda en el historial)
            </Label>
            <Textarea
              id="version-descripcion"
              rows={3}
              maxLength={500}
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              placeholder="Qué se actualizó y por qué"
            />
          </div>
        </div>
        <div className="flex shrink-0 justify-end gap-2 border-t border-gray-200 px-6 py-3 dark:border-gray-700">
          <Button color="alternative" onClick={onCancelar}>
            Cancelar
          </Button>
          <Button
            color="blue"
            disabled={guardando || !descripcion.trim()}
            onClick={() => onConfirmar(bump, descripcion.trim())}
          >
            Guardar versión {destino}
          </Button>
        </div>
      </div>
    </AbsoluteModal>
  );
}
