"use client";

// Tarjeta de lista del panel lateral: un marco y secciones plegables
// (lugares, trayectos) con encabezado, filas y un menú de tres puntos.
import { useState, type ReactNode } from "react";
import { Dropdown, DropdownDivider, DropdownItem } from "flowbite-react";
import {
  HiDotsVertical,
  HiOutlinePencil,
  HiOutlineTrash,
} from "react-icons/hi";
import { twMerge } from "tailwind-merge";

export function ListCard({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
      {children}
    </div>
  );
}

export function ListSection({
  titulo,
  total,
  vacio,
  children,
}: {
  titulo: string;
  total: number;
  /** Texto cuando no hay filas. */
  vacio: string;
  children: ReactNode;
}) {
  const [abierto, setAbierto] = useState(true);
  const plegar = () => setAbierto((v) => !v);

  return (
    <section>
      <button
        type="button"
        aria-expanded={abierto}
        aria-label={abierto ? `Ocultar ${titulo}` : `Mostrar ${titulo}`}
        onClick={plegar}
        className="flex w-full items-center justify-between gap-2 border-b border-gray-200 bg-gray-50 px-3 py-1 text-left hover:bg-gray-100 dark:border-gray-700 dark:bg-gray-700/50 dark:hover:bg-gray-700"
      >
        <h3 className="min-w-0 truncate text-xs font-semibold text-gray-900 dark:text-white">
          {titulo}
        </h3>
        <span className="rounded-full bg-gray-200 px-1.5 py-px text-[10px] font-medium text-gray-700 dark:bg-gray-600 dark:text-gray-200">
          {total}
        </span>
      </button>
      {abierto &&
        (total === 0 ? (
          <p className="px-3 py-3 text-xs text-gray-500 dark:text-gray-400">
            {vacio}
          </p>
        ) : (
          <ul className="divide-y divide-gray-100 dark:divide-gray-700">
            {children}
          </ul>
        ))}
    </section>
  );
}

function RowMenu({
  nombre,
  onEditar,
  onEliminar,
}: {
  nombre: string;
  onEditar: () => void;
  onEliminar: () => void;
}) {
  return (
    <Dropdown
      label=""
      inline
      dismissOnClick
      placement="bottom-end"
      renderTrigger={() => (
        <button
          type="button"
          aria-label={`Opciones de ${nombre}`}
          className="flex h-7 w-7 flex-none items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-white"
        >
          <HiDotsVertical className="h-4 w-4" />
        </button>
      )}
    >
      <DropdownItem icon={HiOutlinePencil} onClick={onEditar}>
        Editar
      </DropdownItem>
      <DropdownDivider />
      <DropdownItem
        icon={HiOutlineTrash}
        onClick={onEliminar}
        className="text-rose-600 dark:text-rose-400"
      >
        Eliminar
      </DropdownItem>
    </Dropdown>
  );
}

export function ListCardRow({
  icono,
  nombre,
  detalle,
  seleccionado,
  onIr,
  extras,
  onEditar,
  onEliminar,
  className,
  compact = false,
  as: Tag = "li",
  onHoverStart,
  onHoverEnd,
  onExpandir,
  expandido,
}: {
  icono?: ReactNode;
  nombre: string;
  detalle: string;
  /** Abierto en la ventana flotante: resaltado. */
  seleccionado: boolean;
  /** Clic en el nombre: ir a él en el mapa. */
  onIr: () => void;
  /** Distintivos o acciones rápidas antes del menú (ej. "local", "+"). */
  extras?: ReactNode;
  onEditar: () => void;
  onEliminar: () => void;
  className?: string;
  /** Una sola línea, para hijos de un lugar. */
  compact?: boolean;
  as?: "li" | "div";
  onHoverStart?: () => void;
  onHoverEnd?: () => void;
  /** Clic en la fila (nombre incluido) pliega o despliega hijos. */
  onExpandir?: () => void;
  expandido?: boolean;
}) {
  const irYExpandir = (e: { stopPropagation: () => void }) => {
    e.stopPropagation();
    onIr();
    onExpandir?.();
  };
  const noExpandir = (e: { stopPropagation: () => void }) => {
    e.stopPropagation();
  };

  return (
    <Tag
      className={twMerge(
        "flex items-center gap-2",
        compact
          ? "gap-1 py-0 pr-0.5 pl-2 hover:bg-gray-200 dark:hover:bg-gray-800"
          : "py-1 pr-1 pl-3 hover:bg-gray-50 dark:hover:bg-gray-700/40",
        seleccionado &&
          "bg-blue-50 hover:bg-blue-50 dark:bg-blue-900/20 dark:hover:bg-blue-900/20",
        className
      )}
      onMouseEnter={onHoverStart}
      onMouseLeave={onHoverEnd}
      onClick={onExpandir}
    >
      {icono}
      <button
        type="button"
        className="min-w-0 flex-1 text-left"
        title="Ver en el mapa"
        aria-expanded={onExpandir ? expandido : undefined}
        aria-label={
          onExpandir
            ? expandido
              ? `Ocultar interiores de ${nombre}`
              : `Mostrar interiores de ${nombre}`
            : undefined
        }
        onClick={irYExpandir}
      >
        <div
          className={twMerge(
            "truncate text-gray-900 dark:text-white",
            compact ? "text-xs" : "text-sm"
          )}
        >
          {nombre}
        </div>
        {!compact && (
          <div className="truncate text-[11px] text-gray-500 dark:text-gray-400">
            {detalle}
          </div>
        )}
      </button>
      <div className="flex flex-none items-center" onClick={noExpandir}>
        {extras}
        <RowMenu nombre={nombre} onEditar={onEditar} onEliminar={onEliminar} />
      </div>
    </Tag>
  );
}
