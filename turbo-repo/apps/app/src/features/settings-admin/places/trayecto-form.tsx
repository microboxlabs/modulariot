"use client";

// Formulario de trayecto en dos pestañas: el trayecto (puntos sobre el mapa)
// y su información (nombre, tipo, ancho…).
import { useRef, useState, type Dispatch, type SetStateAction } from "react";
import { twMerge } from "tailwind-merge";
import {
  Field,
  FloatingWindow,
  FormFooter,
  Segmented,
  SegmentedBar,
  inputCls,
  inputErrorCls,
} from "./form-ui";
import type { FormTrayecto, LatLon, PasoTrayecto } from "./places.types";
import { IconPicker } from "./icons";
import RecorridoCard, { type OnRecorrido } from "./recorrido-card";
import { SizeInput } from "./poly-base-fields";

/** Ancho del corredor en metros (mismo control que el radio de geocercas). */
const ANCHO_MIN = 1;
const ANCHO_MAX = 10_000;

function noopElegirMapa(_id: string) {}

const PESTANAS: { value: PasoTrayecto; label: string }[] = [
  { value: "recorrido", label: "Trayecto" },
  { value: "datos", label: "Información del trayecto" },
];

/** Título fijo: crear o editar, sin importar el paso ni el nombre. */
export function tituloTrayecto(tray: FormTrayecto): string {
  return tray.id ? "Editar trayecto" : "Crear trayecto";
}

function estadoRuta(tray: FormTrayecto, calculando: boolean): string {
  if (calculando) return "Calculando ruta…";
  return tray.ajustado ? "Ruta por calles" : "Línea recta";
}

/** Resumen del recorrido, en la pestaña de información. */
function ResumenRecorrido({
  tray,
  calculando,
}: {
  tray: FormTrayecto;
  calculando: boolean;
}) {
  const ubicados = tray.recorrido.filter((p) => p.punto);
  const paradas = Math.max(ubicados.length - 2, 0);
  const desde = ubicados[0]?.texto ?? "";
  const hasta = ubicados[ubicados.length - 1]?.texto ?? "";
  return (
    <div className="rounded-lg border border-gray-200 px-3 py-2 dark:border-gray-600">
      <h3 className="text-xs font-semibold text-gray-900 dark:text-white">
        Recorrido
      </h3>
      <p
        className="mt-1 truncate text-xs text-gray-700 dark:text-gray-200"
        title={`${desde} → ${hasta}`}
      >
        {desde} → {hasta}
      </p>
      <p className="text-[11px] text-gray-500 dark:text-gray-400">
        {paradas === 1 ? "1 parada" : `${paradas} paradas`} ·{" "}
        {estadoRuta(tray, calculando)}
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
  className,
}: {
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
  onSave: () => void;
  onClose: () => void;
  className?: string;
}) {
  const set = <K extends keyof FormTrayecto>(key: K, value: FormTrayecto[K]) =>
    setTray((t) => ({ ...t, [key]: value }));
  const cambiarTipo = (kind: FormTrayecto["kind"]) =>
    onTipo ? onTipo(kind) : set("kind", kind);

  // guardar sin nombre en la información: el campo se marca y recibe el foco
  const nombreRef = useRef<HTMLInputElement>(null);
  const [intento, setIntento] = useState(false);
  const faltaNombre = intento && !tray.name.trim();
  const guardar = () => {
    if (paso === "datos") {
      setIntento(true);
      if (!tray.name.trim()) nombreRef.current?.focus();
    }
    onSave();
  };

  return (
    <FloatingWindow
      className={twMerge("h-[calc(100%-2rem)]", className)}
      title={tituloTrayecto(tray)}
      onClose={onClose}
      toolbar={
        <SegmentedBar
          value={paso}
          options={PESTANAS}
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
          saveLabel="Guardar trayecto"
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
          className="min-h-0 flex-1"
        />
      ) : (
        <div className="-mx-4 min-h-0 flex-1 space-y-3 overflow-y-auto px-4">
          <ResumenRecorrido tray={tray} calculando={guardando} />

          <Field label="Nombre *">
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
                placeholder="Ej: Acceso norte"
                value={tray.name}
                onChange={(e) => set("name", e.target.value)}
              />
            </div>
          </Field>

          <Field label="Tipo">
            <Segmented
              value={tray.kind}
              onChange={cambiarTipo}
              options={[
                { value: "vial", label: "Vial (ruta)" },
                { value: "interno", label: "Interno (faena)" },
              ]}
            />
          </Field>

          <SizeInput
            label="Ancho del corredor"
            value={tray.width_m}
            min={ANCHO_MIN}
            max={ANCHO_MAX}
            onChange={(m) => set("width_m", m)}
          />

          <Field label="External ID">
            <input
              className={inputCls}
              placeholder="Opcional"
              value={tray.external_id}
              onChange={(e) => set("external_id", e.target.value)}
            />
          </Field>
        </div>
      )}
    </FloatingWindow>
  );
}
