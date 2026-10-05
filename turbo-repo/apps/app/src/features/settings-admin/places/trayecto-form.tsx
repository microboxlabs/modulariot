"use client";

import type { Dispatch, SetStateAction } from "react";
import { HiCheck } from "react-icons/hi";
import {
  Field,
  FloatingWindow,
  FormFooter,
  Segmented,
  SegmentedBar,
  inputCls,
} from "./form-ui";
import type { FormTrayecto, LatLon, MetodoTrayecto } from "./places.types";
import { IconPicker } from "./icons";
import RecorridoCard, { type OnRecorrido } from "./recorrido-card";

export default function TrayectoForm({
  tray,
  setTray,
  guardando,
  msg,
  onUndoPoint,
  onAjustar,
  onSave,
  onClose,
  token,
  cerca,
  onMetodo,
  onRecorrido,
}: {
  tray: FormTrayecto;
  setTray: Dispatch<SetStateAction<FormTrayecto>>;
  guardando: boolean;
  msg: string | null;
  onUndoPoint: () => void;
  onAjustar: () => void;
  token: string | undefined;
  cerca: () => LatLon | null;
  onMetodo: (m: MetodoTrayecto) => void;
  onRecorrido: OnRecorrido;
  onSave: () => void;
  onClose: () => void;
}) {
  const set = <K extends keyof FormTrayecto>(key: K, value: FormTrayecto[K]) =>
    setTray((t) => ({ ...t, [key]: value }));

  return (
    <FloatingWindow
      title={tray.id ? "Editar trayecto" : "Crear trayecto"}
      toolbar={
        <SegmentedBar
          value={tray.metodo}
          onChange={onMetodo}
          activeCls="border-purple-600 text-purple-700 dark:border-purple-500 dark:text-purple-300"
          options={[
            { value: "manual", label: "Manual" },
            { value: "direccion", label: "Por dirección" },
          ]}
        />
      }
      onClose={onClose}
      footer={
        <FormFooter
          msg={msg}
          guardando={guardando}
          saveLabel="Guardar trayecto"
          saveCls="bg-purple-600 hover:bg-purple-700"
          onCancel={onClose}
          onSave={onSave}
        />
      }
    >
      {tray.metodo === "direccion" && (
        <RecorridoCard
          tray={tray}
          calculando={guardando}
          token={token}
          cerca={cerca}
          onRecorrido={onRecorrido}
        />
      )}

      <Field label="Nombre *">
        <div className="flex gap-2">
          <IconPicker
            value={tray.icon}
            fallback="ruta"
            accentCls="text-purple-600 dark:text-purple-400"
            onChange={(icon) => set("icon", icon)}
          />
          <input
            className={inputCls}
            placeholder="Ej: Acceso norte"
            value={tray.name}
            onChange={(e) => set("name", e.target.value)}
          />
        </div>
      </Field>

      <Field label="Tipo">
        <Segmented
          value={tray.kind}
          onChange={(kind) => set("kind", kind)}
          options={[
            { value: "vial", label: "Vial (ruta)" },
            { value: "interno", label: "Interno (faena)" },
          ]}
        />
      </Field>

      <Field
        label="Ancho del corredor"
        aside={
          <span className="rounded bg-purple-50 px-1.5 py-0.5 font-semibold text-purple-700 dark:bg-purple-900/40 dark:text-purple-300">
            {tray.width_m} m
          </span>
        }
      >
        <input
          type="range"
          min={10}
          max={200}
          step={10}
          value={tray.width_m}
          className="w-full accent-purple-600"
          onChange={(e) => set("width_m", Number(e.target.value))}
        />
      </Field>

      <Field label="External ID">
        <input
          className={inputCls}
          placeholder="Opcional"
          value={tray.external_id}
          onChange={(e) => set("external_id", e.target.value)}
        />
      </Field>

      {tray.metodo === "manual" && (
        <div className="flex gap-2">
          <button
            type="button"
            disabled={tray.pts.length === 0}
            onClick={onUndoPoint}
            className="flex-1 rounded-lg border border-gray-200 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"
          >
            Deshacer punto
          </button>
          {tray.kind === "vial" && (
            <button
              type="button"
              disabled={tray.pts.length < 2 || guardando}
              onClick={onAjustar}
              className="inline-flex flex-1 items-center justify-center gap-1 rounded-lg border border-purple-300 py-1.5 text-xs font-medium text-purple-700 hover:bg-purple-50 disabled:opacity-50 dark:border-purple-700 dark:text-purple-300 dark:hover:bg-purple-900/30"
            >
              {tray.ajustado && <HiCheck className="h-3.5 w-3.5" />}
              {tray.ajustado ? "Ajustado a calles" : "Ajustar a calles"}
            </button>
          )}
        </div>
      )}
    </FloatingWindow>
  );
}
