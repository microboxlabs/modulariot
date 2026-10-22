"use client";

// Tarjeta de lista del panel lateral: un marco y secciones plegables
// (lugares, trayectos) con encabezado, filas y un menú de tres puntos.
import { useState, type ReactNode } from "react";
import {
  Checkbox,
  Dropdown,
  DropdownDivider,
  DropdownItem,
} from "flowbite-react";
import {
  HiDotsVertical,
  HiOutlinePencil,
  HiOutlineTrash,
} from "react-icons/hi";
import { twMerge } from "tailwind-merge";

/** Selección de filas para acciones en lote (borrar varios). */
export type MarcasLista = {
  marcados: Set<string>;
  onMarcar: (id: string, marcado: boolean) => void;
  /** Elegir o soltar varios de una vez (casilla de la sección). */
  onMarcarVarios: (ids: string[], marcado: boolean) => void;
  /** Hay algo elegido: todas las filas muestran su casilla. */
  siempre: boolean;
};

export type MarcaFila = {
  marcado: boolean;
  onMarcar: (marcado: boolean) => void;
  siempre: boolean;
};

export function marcaDe(
  marcas: MarcasLista | undefined,
  id: string
): MarcaFila | undefined {
  if (!marcas) return undefined;
  return {
    marcado: marcas.marcados.has(id),
    onMarcar: (v) => marcas.onMarcar(id, v),
    siempre: marcas.siempre,
  };
}

/**
 * Casillas de Flowbite sin el anillo al hacer clic: solo con el teclado
 * (focus-visible), para ver dónde está el foco.
 */
export const CASILLA_SIN_ANILLO =
  "cursor-pointer focus:ring-0 focus:ring-offset-0 focus-visible:ring-2 focus-visible:ring-offset-2";

/**
 * Lugar del ícono que, al pasar el mouse (o con el teclado), muestra una
 * casilla en su lugar; con `visible`, la casilla queda fija.
 */
function IconoOCasilla({
  icono,
  visible,
  children,
}: Readonly<{ icono?: ReactNode; visible: boolean; children: ReactNode }>) {
  const alPasar = "hidden group-has-focus-visible:flex group-hover:flex";
  return (
    <span className="flex h-4 w-4 flex-none items-center justify-center">
      {icono && !visible && (
        <span className="flex group-has-focus-visible:hidden group-hover:hidden">
          {icono}
        </span>
      )}
      <span className={visible ? "flex" : alPasar}>{children}</span>
    </span>
  );
}

/** Casilla del encabezado: elige o suelta todas las filas de la sección. */
function CasillaSeccion({
  titulo,
  icono,
  ids,
  marcas,
}: Readonly<{
  titulo: string;
  icono?: ReactNode;
  ids: string[];
  marcas: MarcasLista;
}>) {
  const todas = ids.length > 0 && ids.every((id) => marcas.marcados.has(id));
  return (
    <IconoOCasilla icono={icono} visible={marcas.siempre}>
      <Checkbox
        color="blue"
        aria-label={`Seleccionar todos: ${titulo}`}
        className={CASILLA_SIN_ANILLO}
        checked={todas}
        onChange={() => marcas.onMarcarVarios(ids, !todas)}
      />
    </IconoOCasilla>
  );
}

/** Casilla de una fila, en el lugar de su ícono. */
function CasillaFila({
  marca,
  nombre,
  icono,
}: Readonly<{ marca: MarcaFila; nombre: string; icono?: ReactNode }>) {
  return (
    <IconoOCasilla icono={icono} visible={marca.siempre || marca.marcado}>
      <Checkbox
        color="blue"
        aria-label={`Seleccionar ${nombre}`}
        className={CASILLA_SIN_ANILLO}
        checked={marca.marcado}
        onChange={(e) => marca.onMarcar(e.target.checked)}
      />
    </IconoOCasilla>
  );
}

export function ListCard({ children }: Readonly<{ children: ReactNode }>) {
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
  seleccion,
  icono,
}: Readonly<{
  /** Ícono del encabezado; con selección, al pasar el mouse es la casilla. */
  icono?: ReactNode;
  /** Casilla en el encabezado para elegir todas sus filas. */
  seleccion?: { ids: string[]; marcas: MarcasLista };
  titulo: string;
  total: number;
  /** Texto cuando no hay filas. */
  vacio: string;
  children: ReactNode;
}>) {
  const [abierto, setAbierto] = useState(true);
  const plegar = () => setAbierto((v) => !v);

  return (
    <section>
      <div className="group flex items-center gap-2 border-b border-gray-200 bg-gray-50 pl-3 hover:bg-gray-100 dark:border-gray-700 dark:bg-gray-700/50 dark:hover:bg-gray-700">
        {seleccion && total > 0 ? (
          <CasillaSeccion titulo={titulo} icono={icono} {...seleccion} />
        ) : (
          icono && (
            <span className="flex h-4 w-4 flex-none items-center justify-center">
              {icono}
            </span>
          )
        )}
        <button
          type="button"
          aria-expanded={abierto}
          aria-label={abierto ? `Ocultar ${titulo}` : `Mostrar ${titulo}`}
          onClick={plegar}
          className="flex min-w-0 flex-1 cursor-pointer items-center justify-between gap-2 py-1 pr-3 text-left"
        >
          <h3 className="min-w-0 truncate text-xs font-semibold text-gray-900 dark:text-white">
            {titulo}
          </h3>
          <span className="rounded-full bg-gray-200 px-1.5 py-px text-[10px] font-medium text-gray-700 dark:bg-gray-600 dark:text-gray-200">
            {total}
          </span>
        </button>
      </div>
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
}: Readonly<{
  nombre: string;
  onEditar: () => void;
  onEliminar: () => void;
}>) {
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

/** Nombre accesible del botón cuando la fila pliega interiores. */
function etiquetaExpandir(
  nombre: string,
  onExpandir: (() => void) | undefined,
  expandido: boolean | undefined
): string | undefined {
  if (!onExpandir) return undefined;
  if (expandido) return `Ocultar interiores de ${nombre}`;
  return `Mostrar interiores de ${nombre}`;
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
  marca,
}: Readonly<{
  /** Casilla para elegir la fila (acciones en lote). */
  marca?: MarcaFila;
  icono?: ReactNode;
  nombre: string;
  detalle: string;
  /** Abierto en la ventana flotante: resaltado. */
  seleccionado: boolean;
  /** Clic en el nombre: ir a él en el mapa. */
  onIr: () => void;
  /** Distintivos o acciones rápidas antes del menú (ej. "local", "+"). */
  extras?: ReactNode;
  /** Sin ellos (solo lectura) la fila no tiene menú de tres puntos. */
  onEditar?: () => void;
  onEliminar?: () => void;
  className?: string;
  /** Una sola línea, para hijos de un lugar. */
  compact?: boolean;
  as?: "li" | "div";
  onHoverStart?: () => void;
  onHoverEnd?: () => void;
  /** Clic en la fila (nombre incluido) pliega o despliega hijos. */
  onExpandir?: () => void;
  expandido?: boolean;
}>) {
  // la fila se pliega desde su nombre (un botón); la casilla y el menú
  // quedan aparte, sin manejadores de clic en elementos no interactivos
  const irYExpandir = () => {
    onIr();
    onExpandir?.();
  };

  return (
    <Tag
      className={twMerge(
        "group flex items-center gap-2",
        compact
          ? "gap-1 py-0 pr-0.5 pl-2 hover:bg-gray-200 dark:hover:bg-gray-800"
          : "py-1 pr-1 pl-3 hover:bg-gray-50 dark:hover:bg-gray-700/40",
        seleccionado &&
          "bg-blue-50 hover:bg-blue-50 dark:bg-blue-900/20 dark:hover:bg-blue-900/20",
        className
      )}
      onMouseEnter={onHoverStart}
      onMouseLeave={onHoverEnd}
    >
      {marca ? (
        <CasillaFila marca={marca} nombre={nombre} icono={icono} />
      ) : (
        icono
      )}
      <button
        type="button"
        className="min-w-0 flex-1 text-left"
        title="Ver en el mapa"
        aria-expanded={onExpandir ? expandido : undefined}
        aria-label={etiquetaExpandir(nombre, onExpandir, expandido)}
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
      <div className="flex flex-none items-center">
        {extras}
        {onEditar && onEliminar && (
          <RowMenu
            nombre={nombre}
            onEditar={onEditar}
            onEliminar={onEliminar}
          />
        )}
      </div>
    </Tag>
  );
}
