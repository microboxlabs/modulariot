"use client";

// Gestor de conflictos del import, compacto:
// - Encabezado (tarjeta propia): marcar todo, quitar lo marcado y leyenda.
// - Por archivo: marcar todas sus filas.
// - Por fila: marcar, estado (punto de color) y nombre; si choca con algo,
//   con qué (hover = el mapa muestra ambas) y qué conservar, a la derecha.
// No hay botones de borrar sueltos: se marca y se quita desde el encabezado.
import { useEffect, useRef } from "react";
import { Button, ButtonGroup } from "flowbite-react";
import {
  HiOutlineLocationMarker,
  HiOutlineSwitchHorizontal,
} from "react-icons/hi";
import { twMerge } from "tailwind-merge";
import {
  decisionDe,
  gravedad,
  idConflicto,
  nombreConflicto,
  opcionesDecision,
  type ConflictoImport,
  type DecisionImport,
  type FilaConUid,
} from "./import-conflicts";
import type { LoteImport } from "./import-places";

export const ETIQUETAS_DECISION: Record<DecisionImport, string> = {
  existente: "Existente",
  nuevo: "Nuevo",
  ambos: "Ambos",
};

const AYUDA_DECISION: Record<DecisionImport, string> = {
  existente: "Conservar lo que ya está; esta fila no se importa",
  nuevo: "Importar esta fila en lugar de lo que ya está",
  ambos: "Conservar los dos",
};

type Estado = "total" | "parcial" | "ok";

const puntoEstado: Record<Estado, string> = {
  total: "bg-red-500",
  parcial: "bg-amber-400",
  ok: "bg-blue-500",
};

const textoEstado: Record<Estado, string> = {
  total: "Conflicto total: misma geocerca",
  parcial: "Conflicto parcial: se cruzan",
  ok: "Sin conflicto",
};

// en hover se rellena: queda claro cuál se está viendo en el mapa
const chipCls: Record<"total" | "parcial", string> = {
  total:
    "border-red-300 bg-red-50 text-red-700 hover:border-red-600 hover:bg-red-600 hover:text-white dark:border-red-800 dark:bg-red-950/40 dark:text-red-300 dark:hover:bg-red-600 dark:hover:text-white",
  parcial:
    "border-amber-300 bg-amber-50 text-amber-800 hover:border-amber-500 hover:bg-amber-500 hover:text-white dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300 dark:hover:bg-amber-500 dark:hover:text-white",
};

const checkboxCls = "h-3 w-3 shrink-0 rounded border-gray-300 text-blue-600";

export type AccionesImport = {
  conflictos: Map<string, ConflictoImport[]>;
  decisiones: Record<string, DecisionImport>;
  seleccion: string[];
  hoverUid: string | null;
  onDecidir: (uid: string, d: DecisionImport) => void;
  onSeleccionar: (uid: string) => void;
  /** Marca o desmarca todas estas filas (las de un archivo). */
  onMarcarFilas: (uids: string[], marcar: boolean) => void;
  onQuitarFilas: (uids: string[]) => void;
  onHover: (uid: string | null) => void;
  /** Hover en un conflicto: el mapa muestra la fila y aquello con que choca. */
  onHoverConflicto: (uid: string, c: ConflictoImport | null) => void;
};

/** Checkbox que también muestra "algunas marcadas" (indeterminado). */
function CheckboxTodas({
  label,
  marcadas,
  total,
  onCambiar,
}: Readonly<{
  label: string;
  marcadas: number;
  total: number;
  onCambiar: (marcar: boolean) => void;
}>) {
  const ref = useRef<HTMLInputElement>(null);
  const todas = total > 0 && marcadas === total;
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = marcadas > 0 && !todas;
  }, [marcadas, todas]);
  return (
    <input
      ref={ref}
      type="checkbox"
      aria-label={label}
      checked={todas}
      disabled={total === 0}
      onChange={() => onCambiar(!todas)}
      className={checkboxCls}
    />
  );
}

/** Chip con el nombre de aquello con que choca; hover = verlos en el mapa. */
function ChipConflicto({
  uid,
  c,
  onHover,
}: Readonly<{
  uid: string;
  c: ConflictoImport;
  onHover: (uid: string, c: ConflictoImport | null) => void;
}>) {
  const entrar = () => onHover(uid, c);
  const salir = () => onHover(uid, null);
  const donde = c.con.tipo === "fila" ? "en este import" : "guardado";
  return (
    <span
      onMouseEnter={entrar}
      onMouseLeave={salir}
      title={`${nombreConflicto(c)} (${donde}) · pasa el mouse para verlos en el mapa`}
      className={twMerge(
        "max-w-28 cursor-default truncate rounded border px-1 leading-4 transition-colors",
        chipCls[c.tipo]
      )}
    >
      {nombreConflicto(c)}
    </span>
  );
}

/** Existente / Nuevo / Ambos con el grupo de botones de Flowbite. */
function SelectorDecision({
  fila,
  cs,
  elegida,
  onDecidir,
}: Readonly<{
  fila: FilaConUid;
  cs: ConflictoImport[];
  elegida: DecisionImport | undefined;
  onDecidir: (uid: string, d: DecisionImport) => void;
}>) {
  const actual = decisionDe(cs, elegida);
  return (
    <ButtonGroup aria-label={`Qué conservar para ${fila.name}`}>
      {opcionesDecision(cs).map((d) => (
        <Button
          key={d}
          size="xs"
          color={actual === d ? "blue" : "alternative"}
          aria-pressed={actual === d}
          title={AYUDA_DECISION[d]}
          onClick={() => onDecidir(fila.uid, d)}
          // en un grupo Flowbite pone borde izquierdo al primero, y el azul
          // sólido no le da color: quedaría blanco (el color del texto)
          className={twMerge(
            "px-2 py-0.5 text-[10px]",
            actual === d && "border-blue-700 dark:border-blue-600"
          )}
        >
          {ETIQUETAS_DECISION[d]}
        </Button>
      ))}
    </ButtonGroup>
  );
}

function FilaImportRow({
  fila,
  acciones,
}: Readonly<{
  fila: FilaConUid;
  acciones: AccionesImport;
}>) {
  const cs = acciones.conflictos.get(fila.uid);
  const estado: Estado = cs ? gravedad(cs) : "ok";
  const marcada = acciones.seleccion.includes(fila.uid);
  const conHover = acciones.hoverUid === fila.uid;
  const entrar = () => acciones.onHover(fila.uid);
  const salir = () => acciones.onHover(null);
  const marcar = () => acciones.onSeleccionar(fila.uid);
  return (
    <li
      onMouseEnter={entrar}
      onMouseLeave={salir}
      className={twMerge(
        "flex items-center gap-2 px-2 py-1 text-[11px] transition-colors",
        conHover
          ? "bg-blue-50 dark:bg-blue-950/30"
          : "hover:bg-gray-50 dark:hover:bg-gray-800"
      )}
    >
      <input
        type="checkbox"
        aria-label={`Seleccionar ${fila.name}`}
        checked={marcada}
        onChange={marcar}
        className={checkboxCls}
      />
      <span
        title={textoEstado[estado]}
        aria-label={textoEstado[estado]}
        className={twMerge(
          "h-2 w-2 shrink-0 rounded-full",
          puntoEstado[estado]
        )}
      />
      {fila.geometry_type === "line" ? (
        <HiOutlineSwitchHorizontal
          aria-label="Trayecto"
          className="h-3.5 w-3.5 shrink-0 text-blue-600"
        />
      ) : (
        <HiOutlineLocationMarker
          aria-label="Geocerca"
          className="h-3.5 w-3.5 shrink-0 text-gray-500"
        />
      )}
      <div className="min-w-0 flex-1">
        <div className="truncate font-medium text-gray-900 dark:text-white">
          {fila.name}
        </div>
        {cs && (
          <div className="mt-0.5 flex items-center gap-1 text-[10px]">
            <span className="shrink-0 text-gray-500 dark:text-gray-400">
              {estado === "total" ? "Igual a" : "Se cruza con"}
            </span>
            <div className="flex min-w-0 gap-1 overflow-hidden">
              {cs.map((c) => (
                <ChipConflicto
                  key={idConflicto(c)}
                  uid={fila.uid}
                  c={c}
                  onHover={acciones.onHoverConflicto}
                />
              ))}
            </div>
          </div>
        )}
      </div>
      {/* qué conservar: centrado a la derecha, a la altura de toda la fila */}
      {cs && (
        <SelectorDecision
          fila={fila}
          cs={cs}
          elegida={acciones.decisiones[fila.uid]}
          onDecidir={acciones.onDecidir}
        />
      )}
    </li>
  );
}

const plural = (n: number, uno: string, varios: string) =>
  `${n} ${n === 1 ? uno : varios}`;

/** "2 geocercas · 1 trayecto": qué trae el archivo. */
function conteoArchivo(filas: FilaConUid[]): string {
  const trayectos = filas.filter((f) => f.geometry_type === "line").length;
  const geocercas = filas.length - trayectos;
  const partes = [];
  if (geocercas) partes.push(plural(geocercas, "geocerca", "geocercas"));
  if (trayectos) partes.push(plural(trayectos, "trayecto", "trayectos"));
  return partes.join(" · ");
}

export function ImportLoteTable({
  lote,
  acciones,
}: Readonly<{
  lote: LoteImport;
  acciones: AccionesImport;
}>) {
  const filas = lote.filas.filter((f): f is FilaConUid => Boolean(f.uid));
  const uids = filas.map((f) => f.uid);
  const marcadas = uids.filter((u) => acciones.seleccion.includes(u)).length;
  const marcarArchivo = (marcar: boolean) =>
    acciones.onMarcarFilas(uids, marcar);
  return (
    <section className="overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
      <header className="flex items-center gap-2 border-b border-gray-100 bg-gray-50 px-2 py-1.5 dark:border-gray-700 dark:bg-gray-800">
        <CheckboxTodas
          label={`Seleccionar todo ${lote.filename}`}
          marcadas={marcadas}
          total={filas.length}
          onCambiar={marcarArchivo}
        />
        <span className="min-w-0 flex-1 truncate text-xs font-semibold text-gray-900 dark:text-white">
          {lote.filename}
        </span>
        <span className="shrink-0 text-[11px] text-gray-500 dark:text-gray-400">
          {conteoArchivo(filas)}
        </span>
      </header>
      <ul className="divide-y divide-gray-100 dark:divide-gray-800">
        {filas.map((f) => (
          <FilaImportRow key={f.uid} fila={f} acciones={acciones} />
        ))}
      </ul>
    </section>
  );
}

/**
 * Encabezado del import, en su propia tarjeta: marcar todo (de todos los
 * archivos), quitar lo marcado y la leyenda de colores con sus cantidades.
 */
export function ImportSelectionBar({
  filas,
  acciones,
  onSeleccionarTodo,
}: Readonly<{
  filas: FilaConUid[];
  acciones: AccionesImport;
  onSeleccionarTodo: (todo: boolean) => void;
}>) {
  const marcadas = acciones.seleccion.length;
  let totales = 0;
  let parciales = 0;
  for (const cs of acciones.conflictos.values()) {
    if (gravedad(cs) === "total") totales += 1;
    else parciales += 1;
  }
  const sinConflicto = filas.length - totales - parciales;
  const quitarMarcadas = () => acciones.onQuitarFilas(acciones.seleccion);
  const leyenda: [Estado, string][] = [
    ["ok", `${sinConflicto} sin conflicto`],
    ["parcial", `${parciales} parcial`],
    ["total", `${totales} total`],
  ];
  return (
    <div className="shrink-0 space-y-1.5 rounded-lg border border-gray-200 bg-white p-2 text-[11px] dark:border-gray-700 dark:bg-gray-900">
      <div className="flex items-center gap-2">
        <label className="flex items-center gap-1.5 font-medium text-gray-700 dark:text-gray-200">
          <CheckboxTodas
            label="Seleccionar todo"
            marcadas={marcadas}
            total={filas.length}
            onCambiar={onSeleccionarTodo}
          />
          Seleccionar todo ({filas.length})
        </label>
        <Button
          size="xs"
          color="red"
          disabled={marcadas === 0}
          onClick={quitarMarcadas}
          className="ml-auto px-2 py-0.5 text-[11px]"
        >
          Quitar seleccionadas ({marcadas})
        </Button>
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-gray-600 dark:text-gray-300">
        {leyenda.map(([estado, texto]) => (
          <span key={estado} className="flex items-center gap-1">
            <span
              className={twMerge("h-2 w-2 rounded-full", puntoEstado[estado])}
            />
            {texto}
          </span>
        ))}
      </div>
    </div>
  );
}
