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
import {
  AvisoCodigoEnUso,
  AvisoCodigoFijo,
  Field,
  IconoEstadoCodigo,
  inputConIconoCls,
  inputCls,
  inputErrorCls,
  inputFijoCls,
} from "../ui/form-ui";
import GeofenceColorPicker from "./geofence-color-picker";
import GeomIconBar from "./geom-icon-bar";
import PolyBaseFields, { pistaPoligono, SizeInput } from "./poly-base-fields";
import {
  aplicarInnerGeomKind,
  aplicarInnerRectangulo,
  colorInner,
  faltantesInner,
  hayFaltantes,
  codigoSugerido,
  nuevoInner,
  SIN_FALTANTES,
  padreTieneGeometria,
  type FaltantesLugar,
} from "./inner-geofences";
import type { FormLugar, InnerGeofence } from "../places.types";
import type { EstadoCodigo } from "../hooks/use-codigo-en-uso";
import { usePlacesT, type TextosLugares } from "../i18n/places-i18n";

function innerDetalle(t: TextosLugares, inner: InnerGeofence): string {
  if (inner.geom === "polygon") {
    const kind = geomKindDe(inner);
    if (kind === "square") {
      return esRectVinculado(inner)
        ? t("shapes.square")
        : t("shapes.rectangle");
    }
    if (kind === "tri") return t("shapes.triangle");
    return inner.vertices.length >= 3
      ? t("shapes.polygon")
      : t("shapes.polygon_open");
  }
  if (inner.lat == null) return t("shapes.circle_unplaced");
  return t("shapes.circle_radius", { radio: String(inner.radius_m) });
}

/** El External ID de la interior: obligatorio, sin repetirse y fijo una vez guardado. */
function CodigoInterior({
  inner,
  onChange,
  falta,
  estado,
  fijo,
}: Readonly<{
  inner: InnerGeofence;
  onChange: (next: InnerGeofence) => void;
  falta: boolean;
  estado: EstadoCodigo | null;
  fijo: boolean;
}>) {
  const t = usePlacesT();
  const setCodigo = (e: ChangeEvent<HTMLInputElement>) =>
    onChange({ ...inner, external_id: e.target.value });
  const invalido = falta || estado?.estado === "en-uso";
  return (
    <Field
      label={t("form.external_id_required")}
      aside={fijo ? <AvisoCodigoFijo /> : undefined}
    >
      <div className="relative">
        <input
          aria-label={t("inners.code_label")}
          className={twMerge(
            inputCls,
            inputConIconoCls,
            invalido && inputErrorCls,
            fijo && inputFijoCls
          )}
          placeholder={t("inners.code_placeholder")}
          aria-invalid={invalido}
          readOnly={fijo}
          value={inner.external_id ?? ""}
          onChange={setCodigo}
        />
        <IconoEstadoCodigo estado={estado} />
      </div>
      {estado?.estado === "en-uso" && <AvisoCodigoEnUso aviso={estado.aviso} />}
    </Field>
  );
}

function InnerEditor({
  inner,
  onChange,
  faltan,
  estado,
  codigoFijo,
}: Readonly<{
  inner: InnerGeofence;
  onChange: (next: InnerGeofence) => void;
  faltan: FaltantesLugar;
  estado: EstadoCodigo | null;
  codigoFijo: boolean;
}>) {
  const t = usePlacesT();
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

  const pistaDelCirculo = ubicada ? "inners.hint_drag" : "inners.hint_place";
  const pista =
    kind === "circle"
      ? t(pistaDelCirculo)
      : pistaPoligono(t, polyBase, inner.lat != null);

  return (
    <div className="space-y-2 px-2 pb-2">
      <CodigoInterior
        inner={inner}
        onChange={onChange}
        falta={!!faltan.codigo}
        estado={estado}
        fijo={codigoFijo}
      />
      <GeomIconBar compact value={kind} onChange={setKind} />
      {kind === "circle" && (
        <SizeInput
          label={t("form.radius")}
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
  estado,
  codigoFijo,
}: Readonly<{
  inner: InnerGeofence;
  selected: boolean;
  onSelect: () => void;
  onChange: (next: InnerGeofence) => void;
  onRemove: () => void;
  faltan: FaltantesLugar;
  /** Si su External ID está libre, en uso o se está revisando. */
  estado: EstadoCodigo | null;
  codigoFijo: boolean;
}>) {
  const t = usePlacesT();
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
        (hayFaltantes(faltan) || estado?.estado === "en-uso") &&
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
              placeholder={t("inners.name_placeholder")}
              aria-label={t("inners.name_label")}
              aria-invalid={faltan.name}
              value={inner.name}
              onChange={setNombre}
            />
            <button
              type="button"
              aria-label={t("form.remove_item", {
                nombre: inner.name || t("inners.an_inner"),
              })}
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
                {inner.name.trim() || t("inners.unnamed")}
              </div>
              <div className="truncate text-[11px] text-gray-500 dark:text-gray-400">
                {innerDetalle(t, inner)}
              </div>
            </div>
          </button>
        )}
      </div>
      {selected && (
        <InnerEditor
          inner={inner}
          onChange={onChange}
          faltan={faltan}
          estado={estado}
          codigoFijo={codigoFijo}
        />
      )}
    </li>
  );
}

const SIN_ESTADOS: Readonly<Record<string, EstadoCodigo>> = {};
const sinCodigoFijo = () => false;

export default function InnerGeofenceFields({
  form,
  setForm,
  mostrarErrores = false,
  estados = SIN_ESTADOS,
  codigoFijo = sinCodigoFijo,
}: Readonly<{
  form: FormLugar;
  setForm: Dispatch<SetStateAction<FormLugar>>;
  mostrarErrores?: boolean;
  /** El estado del External ID de cada interior, por su id. */
  estados?: Readonly<Record<string, EstadoCodigo>>;
  /** Interior guardada con su External ID: ese no se cambia. */
  codigoFijo?: (id: string) => boolean;
}>) {
  const t = usePlacesT();
  const [busca, setBusca] = useState("");
  const padreListo = padreTieneGeometria(form);
  const q = busca.trim().toLowerCase();
  const visibles = q
    ? form.inners.filter((i) => i.name.toLowerCase().includes(q))
    : form.inners;

  const agregarInterior = () => {
    const inner = nuevoInner(form);
    setBusca("");
    setForm((f) => ({
      ...f,
      // propuesto desde el de la geocerca: SCL → SCL-1, SCL-2, …
      inners: [
        ...f.inners,
        { ...inner, external_id: codigoSugerido(f.external_id, f.inners) },
      ],
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
    ? t("inners.none_for", { busqueda: busca.trim() })
    : t("inners.none");

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <div className="relative shrink-0">
        <HiOutlineSearch className="pointer-events-none absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <input
          type="search"
          className={twMerge(inputCls, "pl-8")}
          placeholder={t("inners.search_placeholder")}
          value={busca}
          aria-label={t("inners.search")}
          onChange={(e) => setBusca(e.target.value)}
        />
      </div>
      {!padreListo && (
        <p className="shrink-0 text-[11px] text-amber-700 dark:text-amber-400">
          {t("inners.place_parent_first")}
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
              estado={estados[inner.id] ?? null}
              codigoFijo={codigoFijo(inner.id)}
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
        {t("inners.add")}
      </button>
    </div>
  );
}
