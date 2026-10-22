"use client";

// Tarjeta del recorrido por dirección: encabezado, lista ordenable de puntos
// (asa a la izquierda para arrastrar) y botón para agregar un punto.
import { useEffect, useState } from "react";
import { ReactSortable } from "react-sortablejs";
import {
  HiChevronDown,
  HiCursorClick,
  HiOutlineTag,
  HiPlus,
  HiX,
} from "react-icons/hi";
import { MdDragIndicator } from "react-icons/md";
import { twMerge } from "tailwind-merge";
import AddressInput from "../ui/address-input";
import PointCategorySelect, {
  useNombreCategoriaPunto,
} from "./point-category-select";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { SimboloDesvio, SimboloParada } from "./point-symbol";
import type {
  FormTrayecto,
  LatLon,
  Lugar,
  Parada,
  TipoPunto,
} from "../places.types";
import {
  MAX_PUNTOS,
  MIN_PUNTOS,
  agregarPunto,
  elegirPunto,
  distintivos,
  puedeConfirmar,
  type Distintivo,
  quitarPunto,
  reordenar,
  textoPunto,
} from "./recorrido";

/** Aplica un cambio al recorrido; `foco` = punto a centrar si aún no hay ruta. */
export type OnRecorrido = (
  cambio: (t: FormTrayecto) => FormTrayecto,
  foco?: LatLon
) => void;

/** Abre/cierra la categoría del punto; muestra la elegida, si hay. */
function BotonCategoriaPunto({
  label,
  categoria,
  abierta,
  onAlternar,
}: Readonly<{
  label: string;
  categoria: string | undefined;
  abierta: boolean;
  onAlternar: () => void;
}>) {
  const nombre = useNombreCategoriaPunto(categoria);
  return (
    <button
      type="button"
      aria-expanded={abierta}
      aria-label={`Categoría de ${label}`}
      title={nombre ? `Categoría: ${nombre}` : "Elegir categoría"}
      onClick={onAlternar}
      className={twMerge(
        "flex h-7 max-w-24 flex-none items-center gap-0.5 rounded-md px-1 text-[10px] text-gray-500 hover:bg-gray-100 hover:text-blue-600 dark:hover:bg-gray-700 dark:hover:text-blue-300",
        abierta &&
          "bg-gray-100 text-blue-700 dark:bg-gray-700 dark:text-blue-300"
      )}
    >
      <HiOutlineTag className="h-3.5 w-3.5 shrink-0" />
      {nombre && <span className="truncate">{nombre}</span>}
      <HiChevronDown
        className={twMerge(
          "h-3 w-3 shrink-0 transition-transform",
          abierta && "rotate-180"
        )}
      />
    </button>
  );
}

/**
 * Parada o desvío con un solo botón: encendido (por defecto) es parada, el
 * "PARE" con su número; apagado es desvío, un círculo (solo se pasa por ahí).
 */
function BotonTipoPunto({
  distintivo,
  onCambiar,
}: Readonly<{
  distintivo: Distintivo;
  onCambiar: (tipo: TipoPunto) => void;
}>) {
  const esParada = distintivo.rol === "parada";
  const alternar = () => onCambiar(esParada ? "desvio" : "parada");
  return (
    <button
      type="button"
      aria-pressed={esParada}
      aria-label={`${distintivo.label}: ${esParada ? "parada" : "desvío"}`}
      title={
        esParada
          ? "Parada · clic para que sea desvío (solo pasa por ahí)"
          : "Desvío · clic para que sea parada"
      }
      onClick={alternar}
      className="flex h-7 w-7 flex-none items-center justify-center rounded-md hover:bg-gray-100 dark:hover:bg-gray-700"
    >
      {esParada ? (
        <SimboloParada numero={distintivo.letra} />
      ) : (
        <SimboloDesvio />
      )}
    </button>
  );
}

function FilaPunto({
  punto,
  distintivo,
  total,
  token,
  cerca,
  eligiendo,
  resaltado,
  onRecorrido,
  onElegirEnMapa,
  onHover,
  onTipoPunto,
  onCategoriaPunto,
  dict,
  geocercas,
}: Readonly<{
  /** Geocercas para elegir como origen o destino. */
  geocercas?: Lugar[];
  onTipoPunto: (id: string, tipo: TipoPunto) => void;
  onCategoriaPunto?: (id: string, categoria: string | undefined) => void;
  dict?: I18nRecord;
  resaltado: boolean;
  onHover: (id: string | null) => void;
  punto: Parada;
  distintivo: Distintivo;
  total: number;
  token: string | undefined;
  cerca: () => LatLon | null;
  eligiendo: boolean;
  onRecorrido: OnRecorrido;
  onElegirEnMapa: (id: string) => void;
}>) {
  const id = punto.id;
  const { letra, colorCls, label, rol } = distintivo;
  // A y B son origen y destino; solo los del medio son parada o desvío
  const intermedio = rol === "parada" || rol === "desvio";
  const cambiarTipo = (tipo: TipoPunto) => onTipoPunto(id, tipo);
  const marcarEnMapa = () => onElegirEnMapa(id);
  const quitar = () => onRecorrido((x) => quitarPunto(x, id));
  const conCategoria = intermedio && !!onCategoriaPunto;
  const [abierta, setAbierta] = useState(false);
  return (
    <div
      className={twMerge(
        "bg-white transition-colors dark:bg-gray-800",
        resaltado && "bg-blue-50 dark:bg-blue-900/30"
      )}
      data-punto-fila={id}
      onMouseEnter={() => onHover(id)}
      onMouseLeave={() => onHover(null)}
    >
      <div className="flex items-center gap-1 px-1.5 py-1.5">
        <span
          className="drag-handle flex h-7 w-5 flex-none cursor-grab items-center justify-center text-gray-400 hover:text-gray-700 active:cursor-grabbing dark:hover:text-gray-200"
          title="Arrastra para cambiar el orden"
          aria-label={`Mover ${label}`}
        >
          <MdDragIndicator className="h-4 w-4" />
        </span>
        {intermedio && (
          <BotonTipoPunto distintivo={distintivo} onCambiar={cambiarTipo} />
        )}
        <div className="min-w-0 flex-1">
          <AddressInput
            label={label}
            letra={intermedio ? undefined : letra}
            colorCls={colorCls}
            value={punto}
            token={token}
            cerca={cerca}
            onTexto={(t) => onRecorrido((x) => textoPunto(x, id, t))}
            onElegir={(s) => onRecorrido((x) => elegirPunto(x, id, s), s.punto)}
            // origen y destino también pueden ser una geocerca guardada
            geocercas={intermedio ? undefined : geocercas}
          />
        </div>
        {conCategoria && (
          <BotonCategoriaPunto
            label={label}
            categoria={punto.categoria}
            abierta={abierta}
            onAlternar={() => setAbierta((x) => !x)}
          />
        )}
        <button
          type="button"
          aria-pressed={eligiendo}
          aria-label={
            eligiendo
              ? `Cancelar marcar ${label} en el mapa`
              : `Marcar ${label} en el mapa`
          }
          title={
            eligiendo ? "Clic en el mapa para ubicar" : "Ubicar en el mapa"
          }
          onClick={marcarEnMapa}
          className={twMerge(
            "flex h-7 w-7 flex-none items-center justify-center rounded-md",
            eligiendo
              ? "bg-blue-100 text-blue-700 ring-1 ring-blue-400 dark:bg-blue-900/40 dark:text-blue-300"
              : "text-gray-400 hover:bg-gray-100 hover:text-blue-600 dark:hover:bg-gray-700 dark:hover:text-blue-300"
          )}
        >
          <HiCursorClick className="h-4 w-4" />
        </button>
        <button
          type="button"
          aria-label={`Quitar ${label}`}
          disabled={total <= MIN_PUNTOS}
          onClick={quitar}
          className="flex h-7 w-6 flex-none items-center justify-center rounded text-gray-400 hover:bg-gray-100 hover:text-rose-600 disabled:hidden dark:hover:bg-gray-700"
        >
          <HiX className="h-3.5 w-3.5" />
        </button>
      </div>
      {/* desplegable al pie de la fila: la categoría del punto y su lista */}
      {conCategoria && abierta && (
        // solo el desplegable: la categoría ya se lee dentro de él
        // y se resalta junto con la fila al pasar el mouse
        <div
          className={twMerge(
            "flex items-center gap-2 border-t border-gray-100 bg-gray-50 px-2 py-1.5 transition-colors dark:border-gray-700 dark:bg-gray-900/40",
            resaltado && "bg-blue-50 dark:bg-blue-900/30"
          )}
        >
          <div className="min-w-0 flex-1">
            <PointCategorySelect
              label={label}
              value={punto.categoria}
              onChange={(c) => onCategoriaPunto?.(id, c)}
              dict={dict ?? {}}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function sinHover() {
  // sin resaltado: la tarjeta no está conectada al mapa
}
function sinTipo() {
  // sin tipo de punto: la tarjeta solo muestra el recorrido
}

function estadoRecorrido(tray: FormTrayecto, calculando: boolean): string {
  if (calculando) return "Calculando ruta…";
  if (puedeConfirmar(tray))
    return "Haz clic en «Listo» para ver cómo quedará el trayecto";
  return `${tray.recorrido.length} puntos`;
}

export default function RecorridoCard({
  tray,
  calculando,
  token,
  cerca,
  onRecorrido,
  eligiendoPuntoId = null,
  onElegirEnMapa,
  resaltadoId = null,
  onHoverPunto = sinHover,
  onTipoPunto = sinTipo,
  onCategoriaPunto,
  dict,
  className,
  geocercas,
}: Readonly<{
  /** Geocercas guardadas, para elegirlas como origen o destino. */
  geocercas?: Lugar[];
  /** Parada o desvío de un punto intermedio (no cambia la ruta). */
  onTipoPunto?: (id: string, tipo: TipoPunto) => void;
  /** Categoría de un punto intermedio; sin esto no se muestra el selector. */
  onCategoriaPunto?: (id: string, categoria: string | undefined) => void;
  /** Diccionario completo (control de la lista de categorías). */
  dict?: I18nRecord;
  className?: string;
  /** Punto resaltado (hover en la lista o en el mapa). */
  resaltadoId?: string | null;
  onHoverPunto?: (id: string | null) => void;
  tray: FormTrayecto;
  calculando: boolean;
  token: string | undefined;
  cerca: () => LatLon | null;
  onRecorrido: OnRecorrido;
  eligiendoPuntoId?: string | null;
  onElegirEnMapa: (id: string) => void;
}>) {
  const total = tray.recorrido.length;
  const ds = distintivos(tray.recorrido);
  const lleno = total >= MAX_PUNTOS;
  // el punto nuevo queda listo para ubicarlo con un clic en el mapa
  const agregarYUbicar = () => {
    const next = agregarPunto(tray);
    const nuevo = next.recorrido.find(
      (p) => !tray.recorrido.some((q) => q.id === p.id)
    );
    if (!nuevo) return;
    onRecorrido(() => next);
    onElegirEnMapa(nuevo.id);
  };
  const iEligiendo = tray.recorrido.findIndex((p) => p.id === eligiendoPuntoId);
  const hintMapa =
    iEligiendo >= 0
      ? `Clic en el mapa para ubicar ${ds[iEligiendo]?.label ?? ""}`
      : null;

  useEffect(() => {
    if (!eligiendoPuntoId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onElegirEnMapa(eligiendoPuntoId);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [eligiendoPuntoId, onElegirEnMapa]);

  return (
    // sin overflow-hidden en la tarjeta: las sugerencias de dirección se
    // despliegan dentro del área desplazable de la lista
    <div
      className={twMerge(
        "flex flex-col rounded-lg border border-gray-200 dark:border-gray-600",
        className
      )}
    >
      <div className="flex shrink-0 items-center justify-between rounded-t-lg border-b border-gray-200 bg-gray-50 px-3 py-2 dark:border-gray-600 dark:bg-gray-700/50">
        <h3 className="text-xs font-semibold text-gray-900 dark:text-white">
          Recorrido
        </h3>
        <span className="text-[11px] text-gray-500 dark:text-gray-400">
          {hintMapa ?? estadoRecorrido(tray, calculando)}
        </span>
      </div>

      <ReactSortable
        list={tray.recorrido}
        setList={(xs) =>
          onRecorrido((t) =>
            reordenar(
              t,
              xs.map((x) => x.id)
            )
          )
        }
        handle=".drag-handle"
        animation={150}
        // la lista ocupa el alto libre y se desplaza por dentro
        className="min-h-0 flex-1 divide-y divide-gray-100 overflow-y-auto dark:divide-gray-700"
      >
        {tray.recorrido.map((p, i) => (
          <FilaPunto
            key={p.id}
            punto={p}
            distintivo={ds[i]!}
            total={total}
            token={token}
            cerca={cerca}
            eligiendo={p.id === eligiendoPuntoId}
            resaltado={p.id === resaltadoId}
            onRecorrido={onRecorrido}
            onElegirEnMapa={onElegirEnMapa}
            onHover={onHoverPunto}
            onTipoPunto={onTipoPunto}
            onCategoriaPunto={onCategoriaPunto}
            dict={dict}
            geocercas={geocercas}
          />
        ))}
      </ReactSortable>

      <button
        type="button"
        onClick={agregarYUbicar}
        disabled={lleno}
        className="inline-flex w-full shrink-0 items-center justify-center gap-1 rounded-b-lg bg-blue-600 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-300 dark:disabled:bg-gray-600"
      >
        <HiPlus className="h-3.5 w-3.5" />
        {lleno ? `Máximo ${MAX_PUNTOS} puntos` : "Agregar punto"}
      </button>
    </div>
  );
}
