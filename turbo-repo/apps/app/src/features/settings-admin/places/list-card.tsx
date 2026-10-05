"use client";

// Tarjeta de lista del panel lateral (lugares, trayectos, circuitos): una
// sola tarjeta con encabezado, filas divididas y un menú de tres puntos.
import type { ReactNode } from "react";
import { Dropdown, DropdownDivider, DropdownItem } from "flowbite-react";
import {
  HiDotsVertical,
  HiOutlinePencil,
  HiOutlineTrash,
} from "react-icons/hi";
import { twMerge } from "tailwind-merge";

export function ListCard({
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
  return (
    <div className="overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
      <div className="flex items-center justify-between border-b border-gray-200 bg-gray-50 px-3 py-2 dark:border-gray-700 dark:bg-gray-700/50">
        <h3 className="text-xs font-semibold text-gray-900 dark:text-white">
          {titulo}
        </h3>
        <span className="rounded-full bg-gray-200 px-2 py-0.5 text-[11px] font-medium text-gray-700 dark:bg-gray-600 dark:text-gray-200">
          {total}
        </span>
      </div>
      {total === 0 ? (
        <p className="px-3 py-3 text-xs text-gray-500 dark:text-gray-400">
          {vacio}
        </p>
      ) : (
        <ul className="divide-y divide-gray-100 dark:divide-gray-700">
          {children}
        </ul>
      )}
    </div>
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
}: {
  icono: ReactNode;
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
}) {
  return (
    <li
      className={twMerge(
        "flex items-center gap-2 py-1.5 pr-1.5 pl-3 hover:bg-gray-50 dark:hover:bg-gray-700/40",
        seleccionado &&
          "bg-blue-50 hover:bg-blue-50 dark:bg-blue-900/20 dark:hover:bg-blue-900/20"
      )}
    >
      {icono}
      <button
        type="button"
        className="min-w-0 flex-1 text-left"
        title="Ver en el mapa"
        onClick={onIr}
      >
        <div className="truncate text-sm text-gray-900 dark:text-white">
          {nombre}
        </div>
        <div className="truncate text-[11px] text-gray-500 dark:text-gray-400">
          {detalle}
        </div>
      </button>
      {extras}
      <RowMenu nombre={nombre} onEditar={onEditar} onEliminar={onEliminar} />
    </li>
  );
}
