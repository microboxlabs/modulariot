"use client";

// Tabla editable clave/valor de la metadata de un lugar.
// Enter en "clave" pasa a "valor"; Enter en "valor" pasa a la fila siguiente
// o, si es la última, crea una fila nueva (hasta `max`).
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { HiPlus, HiX } from "react-icons/hi";
import { twMerge } from "tailwind-merge";

type Fila = { k: string; v: string };
type Campo = "k" | "v";

const celdaCls =
  "w-full bg-transparent px-2.5 py-1.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-inset focus:ring-gray-400 dark:text-white dark:placeholder:text-gray-500 dark:focus:ring-white";

export default function MetaTable({
  rows,
  max,
  onRowsChange,
  className,
}: Readonly<{
  rows: Fila[];
  max: number;
  onRowsChange: (rows: Fila[]) => void;
  className?: string;
}>) {
  const [foco, setFoco] = useState<{ i: number; campo: Campo } | null>(null);
  const inputs = useRef(new Map<string, HTMLInputElement>());

  const lleno = rows.length >= max;

  // el foco se aplica después del render que monta la fila/celda destino
  useEffect(() => {
    if (!foco) return;
    inputs.current.get(`${foco.i}-${foco.campo}`)?.focus();
    setFoco(null);
  }, [foco, rows.length]);

  const enfocar = (i: number, campo: Campo) => setFoco({ i, campo });

  const agregar = () => {
    if (lleno) return;
    onRowsChange([...rows, { k: "", v: "" }]);
    enfocar(rows.length, "k");
  };

  const editar = (i: number, campo: Campo, valor: string) =>
    onRowsChange(rows.map((r, j) => (j === i ? { ...r, [campo]: valor } : r)));

  const quitar = (i: number) => onRowsChange(rows.filter((_, j) => j !== i));

  const alPresionar = (
    e: KeyboardEvent<HTMLInputElement>,
    i: number,
    campo: Campo
  ) => {
    if (e.key !== "Enter" || e.nativeEvent.isComposing) return;
    e.preventDefault();
    if (campo === "k") return enfocar(i, "v");
    if (i < rows.length - 1) return enfocar(i + 1, "k");
    // última fila: sin clave no se crea otra, se vuelve a la clave vacía
    if (!rows[i]?.k.trim()) return enfocar(i, "k");
    agregar();
  };

  const registrar =
    (i: number, campo: Campo) => (el: HTMLInputElement | null) => {
      const key = `${i}-${campo}`;
      if (el) inputs.current.set(key, el);
      else inputs.current.delete(key);
    };

  return (
    <div className={twMerge("flex min-h-0 flex-col", className)}>
      <div className="min-h-0 flex-1 overflow-auto rounded-t-md rounded-b-none border border-b-0 border-gray-200 dark:border-gray-600">
        <table className="w-full table-fixed text-left">
          <thead className="sticky top-0 bg-gray-50 text-[11px] font-medium text-gray-500 dark:bg-gray-700/60 dark:text-gray-300">
            <tr>
              <th className="px-2.5 py-1 font-medium">Clave</th>
              <th className="border-l border-gray-200 px-2.5 py-1 font-medium dark:border-gray-600">
                Valor
              </th>
              <th className="w-8">
                <span className="sr-only">Acciones</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {rows.map((r, i) => (
              <tr
                // la clave de la fila es lo que se edita: el índice la mantiene
                key={i} // NOSONAR (typescript:S6479)
                className="group"
              >
                <td className="p-0">
                  <input
                    ref={registrar(i, "k")}
                    className={celdaCls}
                    placeholder="clave"
                    aria-label={`Clave ${i + 1}`}
                    value={r.k}
                    onChange={(e) => editar(i, "k", e.target.value)}
                    onKeyDown={(e) => alPresionar(e, i, "k")}
                  />
                </td>
                <td className="border-l border-gray-100 p-0 dark:border-gray-700">
                  <input
                    ref={registrar(i, "v")}
                    className={celdaCls}
                    placeholder="valor"
                    aria-label={`Valor ${i + 1}`}
                    value={r.v}
                    onChange={(e) => editar(i, "v", e.target.value)}
                    onKeyDown={(e) => alPresionar(e, i, "v")}
                  />
                </td>
                <td className="p-0 text-center">
                  <button
                    type="button"
                    aria-label={`Quitar campo ${i + 1}`}
                    onClick={() => quitar(i)}
                    className="rounded p-1 text-gray-300 opacity-0 hover:text-rose-600 focus:opacity-100 group-hover:opacity-100 group-focus-within:opacity-100 dark:text-gray-500"
                  >
                    <HiX className="h-3.5 w-3.5" />
                  </button>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td
                  colSpan={3}
                  className="px-2.5 py-2 text-xs text-gray-400 dark:text-gray-500"
                >
                  Sin campos
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <button
        type="button"
        onClick={agregar}
        disabled={lleno}
        className="inline-flex w-full shrink-0 items-center justify-center gap-1 rounded-t-none rounded-b-md bg-blue-600 py-1.5 text-xs font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500/40 disabled:cursor-not-allowed disabled:bg-gray-300 dark:disabled:bg-gray-600"
      >
        <HiPlus className="h-3.5 w-3.5" />
        {lleno ? "Máximo alcanzado" : "Agregar campo"}
      </button>
    </div>
  );
}
