"use client";

import type { Dispatch, SetStateAction } from "react";
import MetaTable from "./meta-table";
import CategoryDropdown from "./category-dropdown";
import { IconPicker } from "./icons";
import DateField from "./date-field";
import {
  Field,
  FloatingWindow,
  FormFooter,
  SegmentedBar,
  inputCls,
} from "./form-ui";
import { MAX_METADATA, type Categoria, type FormLugar } from "./places.types";
import { RADIO_MAX, RADIO_MIN } from "./geofence-editor";

export default function PlaceForm({
  form,
  setForm,
  cats,
  guardando,
  msg,
  onSave,
  onClose,
}: {
  form: FormLugar;
  setForm: Dispatch<SetStateAction<FormLugar>>;
  cats: Categoria[];
  guardando: boolean;
  msg: string | null;
  onSave: () => void;
  onClose: () => void;
}) {
  const set = <K extends keyof FormLugar>(key: K, value: FormLugar[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const setGeom = (geom: FormLugar["geom"]) =>
    setForm((f) => ({
      ...f,
      geom,
      vertices: geom === "circle" ? [] : f.vertices,
      cerrado: false,
    }));

  return (
    <FloatingWindow
      title={form.place_id ? "Editar lugar" : "Crear lugar"}
      toolbar={
        <SegmentedBar
          value={form.geom}
          onChange={setGeom}
          activeCls="border-blue-600 text-blue-700 dark:border-blue-500 dark:text-blue-300"
          options={[
            { value: "circle", label: "Círculo" },
            { value: "polygon", label: "Polígono" },
          ]}
        />
      }
      onClose={onClose}
      footer={
        <FormFooter
          msg={msg}
          guardando={guardando}
          saveLabel="Guardar lugar"
          saveCls="bg-blue-600 hover:bg-blue-700"
          onCancel={onClose}
          onSave={onSave}
        />
      }
    >
      {form.geom === "circle" && (
        <Field
          label="Radio"
          aside={
            <span className="rounded bg-blue-50 px-1.5 py-0.5 font-semibold text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
              {form.radius_m} m
            </span>
          }
        >
          <input
            type="range"
            min={RADIO_MIN}
            max={RADIO_MAX}
            step={50}
            value={form.radius_m}
            className="w-full accent-blue-600"
            onChange={(e) => set("radius_m", Number(e.target.value))}
          />
        </Field>
      )}

      <Field label="Nombre *">
        <div className="flex gap-2">
          <IconPicker
            value={form.icon}
            fallback="pin"
            accentCls="text-blue-600 dark:text-blue-400"
            onChange={(icon) => set("icon", icon)}
          />
          <input
            className={inputCls}
            placeholder="Ej: Planta Quilicura"
            value={form.name}
            onChange={(e) => set("name", e.target.value)}
          />
        </div>
      </Field>

      <div className="grid grid-cols-2 gap-2">
        <Field label="Categoría">
          <CategoryDropdown
            value={form.category_id}
            cats={cats}
            onChange={(id) => set("category_id", id)}
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
      {!form.category_id && (
        <p className="-mt-1 text-[11px] text-amber-600 dark:text-amber-400">
          Sin categoría el lugar no genera alertas.
        </p>
      )}

      <Field label="Dirección">
        <input
          className={inputCls}
          placeholder="Opcional"
          value={form.address}
          onChange={(e) => set("address", e.target.value)}
        />
      </Field>

      <Field
        label="Metadata"
        aside={
          <span className="font-normal text-gray-400">
            {form.metadata.length}/{MAX_METADATA}
          </span>
        }
      >
        <MetaTable
          rows={form.metadata}
          max={MAX_METADATA}
          onRowsChange={(metadata) => set("metadata", metadata)}
        />
      </Field>

      <div className="space-y-2 border-t border-gray-100 pt-3 dark:border-gray-700">
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
    </FloatingWindow>
  );
}
