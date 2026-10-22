"use client";

import {
  useState,
  type ChangeEvent,
  type Dispatch,
  type SetStateAction,
} from "react";
import { HiOutlineSearch, HiPlus, HiTrash } from "react-icons/hi";
import { twMerge } from "tailwind-merge";
import {
  INNER_RADIO_MAX,
  INNER_RADIO_MIN,
  INNER_RECT_H_DEF,
  INNER_RECT_W_DEF,
  esFormaParametrica,
  esRectVinculado,
  geomKindDe,
  normalizarPolyBase,
  type GeomKind,
} from "./geofence-editor";
import { inputCls, inputErrorCls } from "../ui/form-ui";
import GeofenceColorPicker from "./geofence-color-picker";
import GeomIconBar from "./geom-icon-bar";
import PolyBaseFields, { pistaPoligono, SizeInput } from "./poly-base-fields";
import {
  aplicarInnerGeomKind,
  aplicarInnerRectangulo,
  colorInner,
  faltantesInner,
  hayFaltantes,
  nuevoInner,
  SIN_FALTANTES,
  padreTieneGeometria,
  type FaltantesLugar,
} from "./inner-geofences";
import type { FormLugar, InnerGeofence } from "../places.types";

function innerDetalle(inner: InnerGeofence): string {
  if (inner.geom === "polygon") {
    const kind = geomKindDe(inner);
    if (kind === "square") {
      return esRectVinculado(inner) ? "Cuadrado" : "Rectángulo";
    }
    if (kind === "tri") return "Triángulo";
    return inner.vertices.length >= 3 ? "Polígono" : "Polígono · sin cerrar";
  }
  if (inner.lat == null) return "Círculo · sin ubicar";
  return `Círculo · ${inner.radius_m} m`;
}

function InnerEditor({
  inner,
  onChange,
  faltan,
}: Readonly<{
  inner: InnerGeofence;
  onChange: (next: InnerGeofence) => void;
  faltan: FaltantesLugar;
}>) {
  const kind = geomKindDe(inner);
  const polyBase = normalizarPolyBase(inner.polyBase);
  const vinculado = esRectVinculado(inner);
  const anchoM = inner.rect_w_m ?? INNER_RECT_W_DEF;
  const altoM = inner.rect_h_m ?? INNER_RECT_H_DEF;
  const ubicada =
    inner.geom === "circle" ? inner.lat != null : inner.vertices.length >= 3;

  const setKind = (next: GeomKind) =>
    onChange(aplicarInnerGeomKind(inner, next));

  const cambiarAncho = (rect_w_m: number) =>
    onChange(aplicarInnerRectangulo({ ...inner, rect_w_m }));

  const cambiarAlto = (rect_h_m: number) =>
    onChange(aplicarInnerRectangulo({ ...inner, rect_h_m }));

  const cambiarVinculo = (rectVinculado: boolean) =>
    onChange(aplicarInnerRectangulo({ ...inner, rectVinculado }));

  const cambiarRadio = (radius_m: number) => onChange({ ...inner, radius_m });

  const pista =
    kind === "circle"
      ? pistaCirculo(ubicada)
      : pistaPoligono(polyBase, inner.lat != null);

  return (
    <div className="space-y-2 px-2 pb-2">
      <GeomIconBar compact value={kind} onChange={setKind} />
      {kind === "circle" && (
        <SizeInput
          label="Radio"
          value={inner.radius_m}
          min={INNER_RADIO_MIN}
          max={INNER_RADIO_MAX}
          onChange={cambiarRadio}
        />
      )}
      {esFormaParametrica(kind) && (
        <PolyBaseFields
          anchoM={anchoM}
          altoM={altoM}
          vinculado={vinculado}
          onAncho={cambiarAncho}
          onAlto={cambiarAlto}
          onVincular={cambiarVinculo}
        />
      )}
      <p
        className={twMerge(
          "rounded-md border px-2 py-1.5 text-[11px] font-medium",
          faltan.ubicacion || faltan.geometria
            ? "border-rose-400 bg-rose-50 text-rose-800 dark:border-rose-700 dark:bg-rose-950/40 dark:text-rose-200"
            : "border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-200"
        )}
      >
        {pista}
      </p>
    </div>
  );
}

function InnerRow({
  inner,
  selected,
  onSelect,
  onChange,
  onRemove,
  faltan,
}: Readonly<{
  inner: InnerGeofence;
  selected: boolean;
  onSelect: () => void;
  onChange: (next: InnerGeofence) => void;
  onRemove: () => void;
  faltan: FaltantesLugar;
}>) {
  const elegir = () => onSelect();
  const quitar = () => onRemove();
  const setColor = (color: string) => onChange({ ...inner, color });
  const setNombre = (e: ChangeEvent<HTMLInputElement>) =>
    onChange({ ...inner, name: e.target.value });

  return (
    <li
      className={twMerge(
        "border-b border-gray-100 last:border-b-0 dark:border-gray-700",
        selected && "bg-blue-50 dark:bg-blue-900/20",
        hayFaltantes(faltan) &&
          "bg-rose-50 ring-1 ring-inset ring-rose-400 dark:bg-rose-950/30 dark:ring-rose-700"
      )}
    >
      <div className="flex items-center gap-1.5 px-2 py-1.5">
        {selected ? (
          <>
            <GeofenceColorPicker
              color={colorInner(inner)}
              onChange={setColor}
            />
            <input
              className={twMerge(
                inputCls,
                "min-w-0 flex-1",
                faltan.name && inputErrorCls
              )}
              placeholder="Ej: Lote VIP"
              aria-label="Nombre de la geocerca interior"
              aria-invalid={faltan.name}
              value={inner.name}
              onChange={setNombre}
            />
            <button
              type="button"
              aria-label={`Quitar ${inner.name || "geocerca interior"}`}
              onClick={quitar}
              className="rounded-md p-1.5 text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/40"
            >
              <HiTrash className="h-4 w-4" />
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={elegir}
            className="flex min-w-0 flex-1 items-center gap-2 py-0.5 text-left"
          >
            <GeofenceColorPicker color={colorInner(inner)} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm text-gray-900 dark:text-white">
                {inner.name.trim() || "Sin nombre"}
              </div>
              <div className="truncate text-[11px] text-gray-500 dark:text-gray-400">
                {innerDetalle(inner)}
              </div>
            </div>
          </button>
        )}
      </div>
      {selected && (
        <InnerEditor inner={inner} onChange={onChange} faltan={faltan} />
      )}
    </li>
  );
}

function pistaCirculo(ubicada: boolean): string {
  return ubicada
    ? "Arrastra el centro o el radio en el mapa"
    : "Clic dentro del lugar para ubicarla";
}

export default function InnerGeofenceFields({
  form,
  setForm,
  mostrarErrores = false,
}: Readonly<{
  form: FormLugar;
  setForm: Dispatch<SetStateAction<FormLugar>>;
  mostrarErrores?: boolean;
}>) {
  const [busca, setBusca] = useState("");
  const padreListo = padreTieneGeometria(form);
  const q = busca.trim().toLowerCase();
  const visibles = q
    ? form.inners.filter((i) => i.name.toLowerCase().includes(q))
    : form.inners;

  const agregarInterior = () => {
    const inner = nuevoInner();
    setBusca("");
    setForm((f) => ({
      ...f,
      inners: [...f.inners, inner],
      innerEditId: inner.id,
    }));
  };

  const cambiarInner = (id: string, next: InnerGeofence) =>
    setForm((f) => ({
      ...f,
      inners: f.inners.map((i) => (i.id === id ? next : i)),
      innerEditId: id,
    }));

  const quitarInner = (id: string) =>
    setForm((f) => ({
      ...f,
      inners: f.inners.filter((i) => i.id !== id),
      innerEditId: f.innerEditId === id ? null : f.innerEditId,
    }));

  const seleccionarInner = (id: string) =>
    setForm((f) => ({ ...f, innerEditId: id }));

  const vacio = q
    ? `Sin geocercas interiores para «${busca.trim()}».`
    : "Aún no hay geocercas interiores.";

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <div className="relative shrink-0">
        <HiOutlineSearch className="pointer-events-none absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <input
          type="search"
          className={twMerge(inputCls, "pl-8")}
          placeholder="Buscar geocerca interior…"
          value={busca}
          aria-label="Buscar geocerca interior"
          onChange={(e) => setBusca(e.target.value)}
        />
      </div>
      {!padreListo && (
        <p className="shrink-0 text-[11px] text-amber-700 dark:text-amber-400">
          Primero ubica el lugar en el mapa para poder dibujar interiores.
        </p>
      )}
      <ul className="min-h-0 flex-1 overflow-y-auto rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800/60">
        {visibles.length === 0 ? (
          <li className="px-3 py-6 text-center text-xs text-gray-500 dark:text-gray-400">
            {vacio}
          </li>
        ) : (
          visibles.map((inner) => (
            <InnerRow
              key={inner.id}
              inner={inner}
              selected={form.innerEditId === inner.id}
              onSelect={() => seleccionarInner(inner.id)}
              onChange={(next) => cambiarInner(inner.id, next)}
              onRemove={() => quitarInner(inner.id)}
              faltan={mostrarErrores ? faltantesInner(inner) : SIN_FALTANTES}
            />
          ))
        )}
      </ul>
      <button
        type="button"
        disabled={!padreListo}
        onClick={agregarInterior}
        className="inline-flex w-full shrink-0 items-center justify-center gap-2 rounded-lg bg-blue-600 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
      >
        <HiPlus className="h-4 w-4" />
        Agregar Geocerca Interior
      </button>
    </div>
  );
}
