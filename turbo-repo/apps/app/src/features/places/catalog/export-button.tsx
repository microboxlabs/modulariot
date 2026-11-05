"use client";

// Exportar: qué (lugares, trayectos o ambos), en qué formato, y descargar.
// Sin filtros por ahora: va todo lo propio de la organización.
import { useEffect, useRef, useState } from "react";
import { Button } from "flowbite-react";
import { HiDownload } from "react-icons/hi";
import { twMerge } from "tailwind-merge";
import { Segmented } from "../ui/form-ui";
import {
  FORMATOS_EXPORT,
  contenidoExport,
  formatosPara,
  nombreArchivoExport,
  type FormatoExport,
  type QueExportar,
} from "../import-export/export-places";
import type { Lugar, Trayecto } from "../places.types";

function descargar(contenido: string, nombre: string, mime: string) {
  const url = URL.createObjectURL(new Blob([contenido], { type: mime }));
  const a = document.createElement("a");
  a.href = url;
  a.download = nombre;
  a.click();
  URL.revokeObjectURL(url);
}

export default function ExportButton({
  lugares,
  trayectos,
  className,
}: Readonly<{
  lugares: Lugar[];
  trayectos: Trayecto[];
  className?: string;
}>) {
  const [abierto, setAbierto] = useState(false);
  const [que, setQue] = useState<QueExportar>("ambos");
  const [formato, setFormato] = useState<FormatoExport>("geojson");
  const caja = useRef<HTMLDivElement>(null);
  const formatos = formatosPara(que);
  // CSV solo sirve para lugares: al cambiar a trayectos vuelve a GeoJSON
  const formatoValido = formatos.includes(formato) ? formato : "geojson";

  useEffect(() => {
    if (!abierto) return;
    const fuera = (e: MouseEvent) => {
      if (!caja.current?.contains(e.target as Node)) setAbierto(false);
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setAbierto(false);
    document.addEventListener("mousedown", fuera);
    window.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", fuera);
      window.removeEventListener("keydown", esc);
    };
  }, [abierto]);

  const cuantos =
    (que === "trayectos" ? 0 : lugares.length) +
    (que === "lugares" ? 0 : trayectos.length);

  const exportar = () => {
    const contenido = contenidoExport(que, formatoValido, lugares, trayectos);
    descargar(
      contenido,
      nombreArchivoExport(que, formatoValido),
      FORMATOS_EXPORT[formatoValido].mime
    );
    setAbierto(false);
  };

  return (
    // flex: el botón toma el alto de la fila, igual que Importar a su lado
    <div ref={caja} className="relative flex shrink-0">
      <button
        type="button"
        aria-expanded={abierto}
        aria-label="Exportar"
        title="Exportar"
        onClick={() => setAbierto((x) => !x)}
        className={twMerge(
          "flex h-full cursor-pointer items-center justify-center",
          className ??
            "rounded-lg border border-gray-300 px-2.5 text-gray-900 hover:bg-gray-50 dark:border-gray-600 dark:text-white dark:hover:bg-gray-700"
        )}
      >
        <HiDownload className="h-4 w-4" />
      </button>
      {abierto && (
        <dialog
          open
          aria-label="Exportar"
          className="absolute top-full right-0 left-auto m-0 text-gray-900 dark:text-white z-30 mt-1 w-96 max-w-[calc(100vw-2rem)] space-y-3 rounded-lg border border-gray-200 bg-white p-3 text-xs shadow-lg dark:border-gray-700 dark:bg-gray-800"
        >
          <div className="space-y-1">
            <p className="font-medium text-gray-700 dark:text-gray-200">
              Qué exportar
            </p>
            <Segmented
              value={que}
              onChange={setQue}
              options={[
                { value: "lugares", label: `Lugares (${lugares.length})` },
                {
                  value: "trayectos",
                  label: `Trayectos (${trayectos.length})`,
                },
                { value: "ambos", label: "Ambos" },
              ]}
            />
          </div>
          <div className="space-y-1">
            <p className="font-medium text-gray-700 dark:text-gray-200">
              Formato
            </p>
            <Segmented
              value={formatoValido}
              onChange={setFormato}
              options={formatos.map((f) => ({
                value: f,
                label: FORMATOS_EXPORT[f].label,
              }))}
            />
            {que !== "lugares" && (
              <p className="text-[10px] text-gray-500 dark:text-gray-400">
                CSV solo está disponible para lugares.
              </p>
            )}
          </div>
          <Button
            size="xs"
            color="blue"
            disabled={cuantos === 0}
            onClick={exportar}
            className="w-full"
          >
            <HiDownload className="mr-1 h-3.5 w-3.5" />
            Descargar ({cuantos})
          </Button>
        </dialog>
      )}
    </div>
  );
}
