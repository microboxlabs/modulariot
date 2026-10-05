"use client";

import type { ReactNode } from "react";
import { HiX } from "react-icons/hi";
import { twMerge } from "tailwind-merge";

export const inputCls =
  "w-full rounded-md border border-gray-200 bg-gray-50 px-2.5 py-1.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-gray-600 dark:bg-gray-700/60 dark:text-white dark:placeholder:text-gray-500 dark:focus:bg-gray-700";

/** Floating card over the map: header, optional full-width toolbar, scrollable body, sticky footer. */
export function FloatingWindow({
  title,
  toolbar,
  onClose,
  footer,
  children,
}: {
  title: string;
  /** Rendered edge to edge right under the header (no padding). */
  toolbar?: ReactNode;
  onClose: () => void;
  footer: ReactNode;
  children: ReactNode;
}) {
  return (
    <div
      data-places-form
      className="absolute top-4 right-4 z-40 flex max-h-[calc(100%-2rem)] w-[340px] flex-col overflow-hidden rounded-xl border border-gray-200 bg-white/95 shadow-2xl backdrop-blur dark:border-gray-700 dark:bg-gray-800/95"
    >
      <div className="flex items-center gap-2 border-b border-gray-100 px-4 py-3 dark:border-gray-700">
        <h2 className="min-w-0 flex-1 truncate text-sm font-semibold text-gray-900 dark:text-white">
          {title}
        </h2>
        <button
          type="button"
          aria-label="Cerrar"
          onClick={onClose}
          className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-700 dark:hover:text-white"
        >
          <HiX className="h-4 w-4" />
        </button>
      </div>
      {toolbar}
      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
        {children}
      </div>
      <div className="border-t border-gray-100 px-4 py-3 dark:border-gray-700">
        {footer}
      </div>
    </div>
  );
}

export function Field({
  label,
  aside,
  children,
}: {
  label: string;
  aside?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="block space-y-1">
      <div className="flex items-center justify-between text-[11px] font-medium text-gray-600 dark:text-gray-300">
        <span>{label}</span>
        {aside}
      </div>
      {children}
    </div>
  );
}

/** Full-width, square tab bar for the FloatingWindow toolbar slot. */
export function SegmentedBar<T extends string>({
  value,
  options,
  onChange,
  activeCls,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
  /** Classes for the selected tab (text + underline color). */
  activeCls: string;
}) {
  return (
    <div className="grid auto-cols-fr grid-flow-col border-b border-gray-100 bg-gray-50 dark:border-gray-700 dark:bg-gray-900/40">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
          className={twMerge(
            "border-b-2 border-transparent py-2 text-xs font-medium text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-700/60 dark:hover:text-white",
            value === o.value && twMerge("bg-white dark:bg-gray-800", activeCls)
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <div className="grid auto-cols-fr grid-flow-col gap-1 rounded-lg bg-gray-100 p-1 dark:bg-gray-700/60">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={twMerge(
            "rounded-md px-2 py-1 text-xs font-medium text-gray-600 transition-colors hover:text-gray-900 dark:text-gray-300 dark:hover:text-white",
            value === o.value &&
              "bg-white text-gray-900 shadow-sm dark:bg-gray-600 dark:text-white"
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function FormFooter({
  msg,
  guardando,
  saveLabel,
  saveCls,
  onCancel,
  onSave,
}: {
  msg: string | null;
  guardando: boolean;
  saveLabel: string;
  saveCls: string;
  onCancel: () => void;
  onSave: () => void;
}) {
  return (
    <div className="space-y-2">
      {msg && <p className="text-xs text-gray-600 dark:text-gray-300">{msg}</p>}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 rounded-lg border border-gray-200 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={onSave}
          disabled={guardando}
          className={twMerge(
            "flex-1 rounded-lg py-1.5 text-sm font-medium text-white disabled:opacity-50",
            saveCls
          )}
        >
          {guardando ? "Guardando…" : saveLabel}
        </button>
      </div>
    </div>
  );
}

/** Marks items saved only in this browser (backend unavailable). */
export function LocalBadge() {
  return (
    <span
      title="Guardado solo en este navegador"
      className="flex-none rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-800 dark:bg-amber-900/40 dark:text-amber-300"
    >
      local
    </span>
  );
}
