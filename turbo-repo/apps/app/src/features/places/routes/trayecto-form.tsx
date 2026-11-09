"use client";

// Formulario de trayecto en dos pestañas: el trayecto (puntos sobre el mapa)
// y su información (nombre, tipo, ancho…).
import { useRef, useState, type Dispatch, type SetStateAction } from "react";
import { twMerge } from "tailwind-merge";
import {
  AvisoCodigoEnUso,
  IconoEstadoCodigo,
  inputConIconoCls,
  Field,
  FloatingWindow,
  FormFooter,
  Segmented,
  SegmentedBar,
  inputCls,
  inputErrorCls,
} from "../ui/form-ui";
import type {
  FormTrayecto,
  LatLon,
  Lugar,
  PasoTrayecto,
  TipoPunto,
} from "../places.types";
import { IconPicker } from "../ui/icons";
import RecorridoCard, { type OnRecorrido } from "./recorrido-card";
import { SizeInput } from "../geofences/poly-base-fields";
import CampoCategorias, {
  CAMPO_CATEGORIAS_TRAYECTO,
} from "../ui/place-categories-field";
import {
  cambiarCategoriaPunto,
  cambiarTipoPunto,
  textoDistancia,
} from "./recorrido";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import VersionBadge from "../versioning/version-badge";
import type { EstadoCodigo } from "../hooks/use-codigo-en-uso";
import {
  ANCHO_MAX,
  ANCHO_MIN,
  faltaExternalIdTrayecto,
} from "./trayecto-validation";
import {
  textosLugares,
  usePlacesT,
  type TextosLugares,
} from "../i18n/places-i18n";

function noopElegirMapa() {}

const pestanas = (
  t: TextosLugares
): { value: PasoTrayecto; label: string }[] => [
  { value: "recorrido", label: t("common.route") },
  { value: "datos", label: t("routes.info_tab") },
];

/** Título fijo: crear o editar, sin importar el paso ni el nombre. */
export function tituloTrayecto(
  tray: FormTrayecto,
  t: TextosLugares = textosLugares()
): string {
  return tray.id ? t("routes.edit_route") : t("map.create_route");
}

function estadoRuta(
  t: TextosLugares,
  tray: FormTrayecto,
  calculando: boolean
): string {
  if (calculando) return t("routes.calculating");
  return tray.ajustado ? t("routes.by_streets") : t("routes.straight_line");
}

/** Origen o destino del resumen: distintivo, rótulo y dirección. */
function ExtremoRecorrido({
  letra,
  colorCls,
  rotulo,
  texto,
}: Readonly<{
  letra: string;
  colorCls: string;
  rotulo: string;
  texto: string;
}>) {
  const t = usePlacesT();
  return (
    <div className="relative flex items-center gap-2">
      <span
        className={twMerge(
          "flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[9px] font-bold text-white",
          colorCls
        )}
      >
        {letra}
      </span>
      <div className="min-w-0 flex-1 leading-tight">
        <span className="block text-[10px] text-gray-500 dark:text-gray-400">
          {rotulo}
        </span>
        <span
          className="block truncate text-xs text-gray-900 dark:text-white"
          title={texto}
        >
          {texto || t("routes.unplaced")}
        </span>
      </div>
    </div>
  );
}

/** Resumen del recorrido, en la pestaña de información. */
function ResumenRecorrido({
  tray,
  calculando,
  distanciaM,
}: Readonly<{
  tray: FormTrayecto;
  calculando: boolean;
  /** Largo del recorrido que se ve en el mapa (por calles o recto). */
  distanciaM?: number;
}>) {
  const t = usePlacesT();
  const ubicados = tray.recorrido.filter((p) => p.punto);
  // paradas y desvíos ubicados entre A y B
  const intermedios = Math.max(ubicados.length - 2, 0);
  const desde = ubicados[0]?.texto ?? "";
  const hasta = ubicados.at(-1)?.texto ?? "";
  return (
    <div className="rounded-lg border border-gray-200 px-3 py-2 dark:border-gray-600">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-xs font-semibold text-gray-900 dark:text-white">
          {t("routes.path")}
        </h3>
        {distanciaM != null && distanciaM > 0 && (
          <span
            title={t("routes.path_distance")}
            className="shrink-0 text-xs font-semibold text-gray-900 tabular-nums dark:text-white"
          >
            {textoDistancia(distanciaM, t)}
          </span>
        )}
      </div>
      {/* origen y destino, cada uno en su fila con su distintivo (A / B) */}
      <div className="relative mt-1.5 space-y-1.5">
        <span
          aria-hidden
          className="absolute top-3 bottom-3 left-[7px] border-l border-dashed border-gray-300 dark:border-gray-600"
        />
        <ExtremoRecorrido
          letra="A"
          colorCls="bg-green-600"
          rotulo={t("routes.from")}
          texto={desde}
        />
        {/* entre A y B: cuántos puntos intermedios hay */}
        {intermedios > 0 && (
          <p className="relative pl-6 text-[11px] text-gray-500 dark:text-gray-400">
            {intermedios === 1
              ? t("routes.midpoints_one")
              : t("routes.midpoints_many", { n: intermedios })}
          </p>
        )}
        <ExtremoRecorrido
          letra="B"
          colorCls="bg-rose-600"
          rotulo={t("routes.to")}
          texto={hasta}
        />
      </div>
      <p className="mt-1.5 text-[11px] text-gray-500 dark:text-gray-400">
        {estadoRuta(t, tray, calculando)}
      </p>
    </div>
  );
}

export default function TrayectoForm({
  tray,
  setTray,
  guardando,
  msg,
  onSave,
  onClose,
  token,
  cerca,
  onRecorrido,
  eligiendoPuntoId = null,
  onElegirEnMapa,
  resaltadoId = null,
  onHoverPunto,
  paso = "recorrido",
  onPaso,
  onTipo,
  onTipoPunto,
  distanciaM,
  className,
  dict,
  version,
  estadoCodigo = null,
  geocercas,
}: Readonly<{
  /** Geocercas guardadas: se pueden elegir como origen o destino. */
  geocercas?: Lugar[];
  /** Diccionario completo (control de la lista de categorías). */
  dict?: I18nRecord;
  /** Versión vigente del trayecto que se edita. */
  version?: string | null;
  /** Si el External ID escrito ya está en uso. */
  estadoCodigo?: EstadoCodigo | null;
  tray: FormTrayecto;
  setTray: Dispatch<SetStateAction<FormTrayecto>>;
  guardando: boolean;
  msg: string | null;
  token: string | undefined;
  cerca: () => LatLon | null;
  onRecorrido: OnRecorrido;
  eligiendoPuntoId?: string | null;
  onElegirEnMapa?: (id: string) => void;
  resaltadoId?: string | null;
  onHoverPunto?: (id: string | null) => void;
  /** Pestaña activa: el trayecto o su información. */
  paso?: PasoTrayecto;
  onPaso: (paso: PasoTrayecto) => void;
  /** Cambiar el tipo puede volver a trazar la ruta (vial = por calles). */
  onTipo?: (kind: FormTrayecto["kind"]) => void;
  /** Parada o desvío: un desvío es punto de paso y puede retrazar la ruta. */
  onTipoPunto?: (id: string, tipo: TipoPunto) => void;
  /** Largo del recorrido en metros (lo calcula el workspace). */
  distanciaM?: number;
  onSave: () => void;
  onClose: () => void;
  className?: string;
}>) {
  const tx = usePlacesT();
  const set = <K extends keyof FormTrayecto>(key: K, value: FormTrayecto[K]) =>
    setTray((t) => ({ ...t, [key]: value }));
  const cambiarCategorias = (categorias: string[], lista: string | null) =>
    setTray((t) => ({ ...t, categorias, categorias_lista: lista }));
  const cambiarTipo = (kind: FormTrayecto["kind"]) =>
    onTipo ? onTipo(kind) : set("kind", kind);
  const cambiarTipoLocal = (id: string, tipo: TipoPunto) =>
    setTray((t) => cambiarTipoPunto(t, id, tipo));

  // guardar sin nombre en la información: el campo se marca y recibe el foco
  const nombreRef = useRef<HTMLInputElement>(null);
  const codigoRef = useRef<HTMLInputElement>(null);
  const [intento, setIntento] = useState(false);
  const faltaNombre = intento && !tray.name.trim();
  const faltaCodigo = intento && faltaExternalIdTrayecto(tray);
  const codigoEnUso = estadoCodigo?.estado === "en-uso";
  const guardar = () => {
    if (paso === "datos") {
      setIntento(true);
      if (!tray.name.trim()) nombreRef.current?.focus();
      else if (faltaExternalIdTrayecto(tray) || codigoEnUso)
        codigoRef.current?.focus();
    }
    onSave();
  };

  return (
    <FloatingWindow
      className={twMerge("h-[calc(100%-2rem)]", className)}
      title={
        <span className="flex items-center gap-2">
          {tituloTrayecto(tray, tx)}
          <VersionBadge version={version} />
        </span>
      }
      onClose={onClose}
      toolbar={
        <SegmentedBar
          value={paso}
          options={pestanas(tx)}
          onChange={onPaso}
          activeCls="border-blue-600 text-blue-700 dark:border-blue-400 dark:text-blue-300"
        />
      }
      // cada pestaña maneja su propio scroll: la lista de puntos ocupa el alto
      bodyClassName="flex min-h-0 flex-col space-y-0 overflow-hidden"
      footer={
        <FormFooter
          msg={msg}
          guardando={guardando}
          saveLabel={tx("routes.save_route")}
          saveCls="bg-blue-600 hover:bg-blue-700"
          onCancel={onClose}
          onSave={guardar}
        />
      }
    >
      {paso === "recorrido" ? (
        <RecorridoCard
          tray={tray}
          calculando={guardando}
          token={token}
          cerca={cerca}
          onRecorrido={onRecorrido}
          eligiendoPuntoId={eligiendoPuntoId}
          onElegirEnMapa={onElegirEnMapa ?? noopElegirMapa}
          resaltadoId={resaltadoId}
          onHoverPunto={onHoverPunto}
          onTipoPunto={onTipoPunto ?? cambiarTipoLocal}
          onCategoriaPunto={(id, c, lista) =>
            setTray((t) => cambiarCategoriaPunto(t, id, c, lista))
          }
          dict={dict}
          geocercas={geocercas}
          className="min-h-0 flex-1"
        />
      ) : (
        <div className="-mx-4 min-h-0 flex-1 space-y-3 overflow-y-auto px-4">
          <ResumenRecorrido
            tray={tray}
            calculando={guardando}
            distanciaM={distanciaM}
          />

          <Field label={tx("form.name_required")}>
            <div className="flex items-center gap-2">
              <IconPicker
                value={tray.icon}
                fallback="ruta"
                onChange={(icon) => set("icon", icon)}
              />
              <input
                ref={nombreRef}
                className={twMerge(inputCls, faltaNombre && inputErrorCls)}
                aria-invalid={faltaNombre}
                placeholder={tx("routes.name_placeholder")}
                value={tray.name}
                onChange={(e) => set("name", e.target.value)}
              />
            </div>
          </Field>

          <Field label={tx("form.external_id_required")}>
            <div className="relative">
              <input
                ref={codigoRef}
                aria-label={tx("form.external_id")}
                className={twMerge(
                  inputCls,
                  inputConIconoCls,
                  (faltaCodigo || codigoEnUso) && inputErrorCls
                )}
                aria-invalid={faltaCodigo || codigoEnUso}
                placeholder={tx("form.code_placeholder")}
                value={tray.external_id}
                onChange={(e) => set("external_id", e.target.value)}
              />
              <IconoEstadoCodigo estado={estadoCodigo} />
            </div>
            {estadoCodigo?.estado === "en-uso" && (
              <AvisoCodigoEnUso aviso={estadoCodigo.aviso} />
            )}
          </Field>

          <Field label={tx("common.categories")}>
            <CampoCategorias
              fieldKey={CAMPO_CATEGORIAS_TRAYECTO}
              label={tx("common.categories")}
              value={tray.categorias}
              listaGuardada={tray.categorias_lista}
              onChange={cambiarCategorias}
              dict={dict ?? {}}
            />
          </Field>

          <Field label={tx("routes.kind")}>
            <Segmented
              value={tray.kind}
              onChange={cambiarTipo}
              options={[
                { value: "vial", label: tx("routes.kind_road") },
                { value: "interno", label: tx("routes.kind_internal") },
              ]}
            />
          </Field>

          <SizeInput
            label={tx("routes.corridor_width")}
            value={tray.width_m}
            min={ANCHO_MIN}
            max={ANCHO_MAX}
            onChange={(m) => set("width_m", m)}
          />
        </div>
      )}
    </FloatingWindow>
  );
}
