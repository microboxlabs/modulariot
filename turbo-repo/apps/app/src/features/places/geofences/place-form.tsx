"use client";

import { useState, type Dispatch, type SetStateAction } from "react";
import { HiOutlineSearch } from "react-icons/hi";
import { twMerge } from "tailwind-merge";
import {
  StepSwap,
  useOutThenIn,
} from "@/features/geographic-view/components/places-overlay/panel-motion";
import CampoCategorias, {
  CAMPO_CATEGORIAS,
} from "../ui/place-categories-field";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { IconPicker } from "../ui/icons";
import DateField from "../ui/date-field";
import AddressInput from "../ui/address-input";
import InnerGeofenceFields from "./inner-geofence-fields";
import PolyBaseFields, { pistaPoligono, SizeInput } from "./poly-base-fields";
import GeomIconBar from "./geom-icon-bar";
import {
  Field,
  FloatingWindow,
  FormFooter,
  inputCls,
  inputErrorCls,
} from "../ui/form-ui";
import GeofenceColorPicker from "./geofence-color-picker";
import {
  colorDeFormLugar,
  type Categoria,
  type FormLugar,
  type LatLon,
  type PasoLugar,
} from "../places.types";
import {
  RADIO_MAX,
  RADIO_MIN,
  aplicarFormaBase,
  aplicarGeomKind,
  esFormaParametrica,
  geomKindDe,
  type GeomKind,
} from "./geofence-editor";
import type { Sugerencia } from "../data/geocoding";
import { faltantesPadre } from "./inner-geofences";
import VersionBadge from "../versioning/version-badge";

export default function PlaceForm({
  form,
  setForm,
  cats,
  guardando,
  msg,
  paso = "geocerca",
  onContinuar,
  onGuardar,
  onBack,
  onClose,
  className,
  token,
  cerca,
  onUbicar,
  dict,
  version,
}: Readonly<{
  /** Diccionario completo (control de la lista de categorías). */
  dict?: I18nRecord;
  /** Versión vigente del lugar que se edita. */
  version?: string | null;
  form: FormLugar;
  setForm: Dispatch<SetStateAction<FormLugar>>;
  cats: Categoria[];
  guardando: boolean;
  msg: string | null;
  paso?: PasoLugar;
  onContinuar: () => void;
  onGuardar: () => void;
  onBack: () => void;
  onClose: () => void;
  className?: string;
  token?: string;
  cerca?: () => LatLon | null;
  onUbicar?: (punto: LatLon, radioM: number) => void;
}>) {
  // la búsqueda va en el formulario: así vuelve con el borrador al recargar
  const { busqueda, ubicadoEn } = form;
  const [intento, setIntento] = useState(false);

  const set = <K extends keyof FormLugar>(key: K, value: FormLugar[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const setKind = (kind: GeomKind) => setForm((f) => aplicarGeomKind(f, kind));
  const setColor = (color: string) => set("color", color);

  const cambiarAncho = (rect_w_m: number) =>
    setForm((f) => aplicarFormaBase({ ...f, rect_w_m }));

  const cambiarAlto = (rect_h_m: number) =>
    setForm((f) => aplicarFormaBase({ ...f, rect_h_m }));

  const cambiarVinculo = (rectVinculado: boolean) =>
    setForm((f) => aplicarFormaBase({ ...f, rectVinculado }));

  const cambiarRadio = (radius_m: number) => set("radius_m", radius_m);

  const cambiarBusqueda = (texto: string) =>
    setForm((f) => ({ ...f, busqueda: texto, ubicadoEn: null }));

  const ubicarDesdeBusqueda = (s: Sugerencia) => {
    const etiqueta = s.contexto ? `${s.nombre}, ${s.contexto}` : s.nombre;
    const [lat, lon] = s.punto;
    setForm((f) =>
      aplicarFormaBase({
        ...f,
        lat,
        lon,
        busqueda: etiqueta,
        ubicadoEn: etiqueta,
      })
    );
    onUbicar?.(s.punto, form.radius_m);
  };

  const sinPunto = () => null;
  const faltan = intento ? faltantesPadre(form) : null;

  const intentarContinuar = () => {
    setIntento(true);
    onContinuar();
  };
  const intentarGuardar = () => {
    setIntento(true);
    onGuardar();
  };
  const step = paso === "interiores" ? 1 : 0;
  const { shown, visible } = useOutThenIn(step);
  const fadeCls = twMerge(
    "transition-opacity duration-200 ease-out motion-reduce:duration-0",
    visible ? "opacity-100" : "pointer-events-none opacity-0"
  );
  const geocercaTitle = form.place_id ? "Editar lugar" : "Crear lugar";
  const interioresTitle = form.name.trim()
    ? `Interiores · ${form.name}`
    : "Geocercas interiores";

  return (
    <FloatingWindow
      className={twMerge("h-[calc(100%-2rem)]", className)}
      title={
        <span className={twMerge("flex items-center gap-2", fadeCls)}>
          {shown === 1 ? interioresTitle : geocercaTitle}
          <VersionBadge version={version} />
        </span>
      }
      onClose={onClose}
      bodyClassName="flex min-h-0 flex-col space-y-0 overflow-hidden"
      toolbar={
        shown === 0 ? (
          <div className={fadeCls}>
            <div className="space-y-1.5 border-b border-sky-100 bg-sky-50 px-4 py-2.5 dark:border-sky-900/40 dark:bg-sky-950/40">
              <div className="flex items-start gap-1.5 text-[11px] leading-snug text-sky-900 dark:text-sky-100">
                <HiOutlineSearch className="mt-0.5 h-3.5 w-3.5 flex-none" />
                <span>Posicionar geocerca</span>
              </div>
              <AddressInput
                label="Ubicar en el mapa"
                value={{
                  texto: busqueda,
                  punto:
                    ubicadoEn && form.lat != null && form.lon != null
                      ? [form.lat, form.lon]
                      : null,
                }}
                token={token}
                cerca={cerca ?? sinPunto}
                placeholder="Buscar dirección o Plus Code…"
                invalido={!!faltan?.ubicacion}
                onTexto={cambiarBusqueda}
                onElegir={ubicarDesdeBusqueda}
              />
            </div>
            <GeomIconBar value={geomKindDe(form)} onChange={setKind} />
          </div>
        ) : undefined
      }
      footer={
        <StepSwap
          step={shown}
          visible={visible}
          first={
            <FormFooter
              msg={msg}
              guardando={guardando}
              saveLabel="Guardar e interiores"
              saveCls="bg-blue-600 hover:bg-blue-700"
              altLabel="Guardar y salir"
              onAlt={intentarGuardar}
              onSave={intentarContinuar}
            />
          }
          second={
            <FormFooter
              msg={msg}
              guardando={guardando}
              saveLabel="Guardar y salir"
              saveCls="bg-blue-600 hover:bg-blue-700"
              altLabel="Atrás"
              onAlt={onBack}
              onSave={intentarGuardar}
            />
          }
        />
      }
    >
      <StepSwap
        className="flex min-h-0 flex-1 flex-col"
        step={shown}
        visible={visible}
        first={
          // con scroll propio: los campos no se comprimen cuando falta alto
          <div className="-mx-4 flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4">
            <div className="shrink-0 space-y-3">
              {geomKindDe(form) === "circle" && (
                <SizeInput
                  label="Radio"
                  value={form.radius_m}
                  min={RADIO_MIN}
                  max={RADIO_MAX}
                  onChange={cambiarRadio}
                />
              )}
              {esFormaParametrica(geomKindDe(form)) && (
                <PolyBaseFields
                  anchoM={form.rect_w_m}
                  altoM={form.rect_h_m}
                  vinculado={form.rectVinculado}
                  onAncho={cambiarAncho}
                  onAlto={cambiarAlto}
                  onVincular={cambiarVinculo}
                />
              )}
              {form.geom === "polygon" && (
                <p
                  className={twMerge(
                    "rounded-md border px-2 py-1.5 text-[11px] font-medium",
                    faltan?.geometria || faltan?.ubicacion
                      ? "border-rose-400 bg-rose-50 text-rose-800 dark:border-rose-700 dark:bg-rose-950/40 dark:text-rose-200"
                      : "border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-200"
                  )}
                >
                  {pistaPoligono(form.polyBase, form.lat != null)}
                </p>
              )}

              <Field label="Nombre *">
                <div className="flex items-center gap-1">
                  <GeofenceColorPicker
                    color={colorDeFormLugar(form, cats)}
                    onChange={setColor}
                  />
                  <IconPicker
                    value={form.icon}
                    fallback="pin"
                    onChange={(icon) => set("icon", icon)}
                  />
                  <input
                    className={twMerge(inputCls, faltan?.name && inputErrorCls)}
                    placeholder="Ej: Planta Quilicura"
                    aria-invalid={!!faltan?.name}
                    value={form.name}
                    onChange={(e) => set("name", e.target.value)}
                  />
                </div>
              </Field>

              <Field label="Categorías">
                <CampoCategorias
                  fieldKey={CAMPO_CATEGORIAS}
                  label="Categorías"
                  value={form.categorias}
                  onChange={(c) => set("categorias", c)}
                  dict={dict ?? {}}
                />
              </Field>

              <Field label="External ID">
                <input
                  className={inputCls}
                  placeholder="Opcional"
                  value={form.external_id}
                  onChange={(e) => set("external_id", e.target.value)}
                />
              </Field>
            </div>

            <div className="shrink-0 space-y-2 border-t border-gray-100 pt-3 dark:border-gray-700">
              <div className="text-[11px] font-medium text-gray-600 dark:text-gray-300">
                Vigencia
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Desde">
                  <DateField
                    label="Vigente desde"
                    value={form.active_from}
                    maxDate={form.active_until || undefined}
                    onChange={(v) => set("active_from", v)}
                  />
                </Field>
                <Field label="Hasta">
                  <DateField
                    label="Vigente hasta"
                    value={form.active_until}
                    minDate={form.active_from || undefined}
                    onChange={(v) => set("active_until", v)}
                  />
                </Field>
              </div>
            </div>
          </div>
        }
        second={
          <InnerGeofenceFields
            form={form}
            setForm={setForm}
            mostrarErrores={intento}
          />
        }
      />
    </FloatingWindow>
  );
}
