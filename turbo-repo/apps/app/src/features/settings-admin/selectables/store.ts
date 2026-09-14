"use client";

/**
 * PROTOTYPE — client-only persistence for Selectables.
 *
 * Stored in `localStorage` under a single key, synced within a tab via a
 * custom event and across tabs via the native `storage` event. No API — this
 * is scaffolding for the Selectables settings page and the gear shortcut in
 * the treatment forms.
 */

import { useCallback, useEffect, useState } from "react";
import type { Selectable, SelectableOption, SelectionMode } from "./types";

const STORAGE_KEY = "miot.prototype.selectables.v1";
const SYNC_EVENT = "miot:selectables-changed";

export function makeId(prefix = "id"): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}

function seedOptions(entries: Array<[string, string]>): SelectableOption[] {
  return entries.map(([name, description]) => ({
    id: makeId("opt"),
    name,
    description,
  }));
}

/**
 * Defaults mirror the hard-coded lists in the current "Llamar al conductor"
 * form so the settings page starts coherent with what the form shows.
 */
export function defaultSelectables(): Selectable[] {
  return [
    {
      id: "who_to_call",
      name: "A quién llamar",
      description:
        "Destinatario de la llamada. Cualquiera distinto del conductor se registra como escalamiento propuesto por el operador.",
      mode: "single",
      options: seedOptions([
        ["Conductor", "Conductor asignado al viaje"],
        ["Transportista / Jefe de transporte", ""],
        ["Jefe de operaciones", ""],
        ["Jefe mina", ""],
        ["Otro", "Detallar en la nota"],
      ]),
    },
    {
      id: "call_result",
      name: "Resultado de la llamada",
      description: "Desenlace del contacto telefónico.",
      mode: "single",
      options: seedOptions([
        ["Contesta — se compromete a corregir", ""],
        ["Contesta — condición ya corregida", ""],
        ["Contesta — rechaza o discute", ""],
        ["No contesta", ""],
        ["Buzón de voz / apagado", ""],
      ]),
    },
    {
      id: "call_tags",
      name: "Etiquetas de llamada",
      description: "Etiquetas opcionales para clasificar el tratamiento.",
      mode: "multiple",
      options: seedOptions([
        ["Ruta con problemas", ""],
        ["Conductor problemático", ""],
        ["Prueba", ""],
      ]),
    },
    {
      id: "ignore_reason",
      name: "Motivo para ignorar",
      description:
        "Por qué el evento es real pero no requiere gestión. Alimenta el bucle de calibración.",
      mode: "single",
      options: seedOptions([
        ["Falso positivo — mapa/límite incorrecto", ""],
        ["Zona de sombra GPS conocida", ""],
        ["Maniobra justificada (adelantamiento)", ""],
        ["Condición operativa autorizada", ""],
        ["Síntoma duplicado", ""],
        ["Otro (detallar en la nota)", ""],
      ]),
    },
    {
      id: "ignore_duration",
      name: "Duración de la omisión",
      description: "Por cuánto tiempo se silencia la condición.",
      mode: "single",
      options: seedOptions([
        ["5 minutos", ""],
        ["30 minutos", ""],
        ["1 hora", ""],
        ["2 horas", ""],
        ["Indefinidamente", ""],
      ]),
    },
    {
      id: "invalidate_reason",
      name: "Motivo de invalidación",
      description:
        "Por qué el síntoma NO es real (dato o regla). Es la etiqueta de aprendizaje del motor.",
      mode: "single",
      options: seedOptions([
        ["Dato GPS incorrecto", ""],
        ["Mapa/límite incorrecto", ""],
        ["Regla mal calibrada", ""],
        ["Síntoma duplicado", ""],
        ["Otro (detallar en la nota)", ""],
      ]),
    },
  ];
}

function read(): Selectable[] {
  if (typeof window === "undefined") return defaultSelectables();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultSelectables();
    const parsed = JSON.parse(raw) as Selectable[];
    if (!Array.isArray(parsed)) return defaultSelectables();
    return parsed;
  } catch {
    return defaultSelectables();
  }
}

function write(next: Selectable[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    window.dispatchEvent(new Event(SYNC_EVENT));
  } catch {
    // storage unavailable (private mode, quota) — the in-memory state still updates.
  }
}

export function useSelectables() {
  const [selectables, setSelectables] = useState<Selectable[]>(() =>
    defaultSelectables()
  );
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setSelectables(read());
    setHydrated(true);
    const sync = () => setSelectables(read());
    window.addEventListener(SYNC_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(SYNC_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const persist = useCallback((next: Selectable[]) => {
    setSelectables(next);
    write(next);
  }, []);

  const update = useCallback(
    (id: string, patch: Partial<Omit<Selectable, "id">>) => {
      persist(
        read().map((s) => (s.id === id ? { ...s, ...patch } : s))
      );
    },
    [persist]
  );

  /**
   * Upserts a whole selectable — used by the create/edit modal, which keeps
   * its own draft in local state and only touches the store once, on Save
   * (so closing/cancelling never leaves a half-filled entry behind). Replaces
   * the existing entry if `next.id` is already present, otherwise appends.
   */
  const save = useCallback(
    (next: Selectable) => {
      const current = read();
      const exists = current.some((s) => s.id === next.id);
      persist(
        exists
          ? current.map((s) => (s.id === next.id ? next : s))
          : [...current, next]
      );
    },
    [persist]
  );

  const add = useCallback(() => {
    const fresh: Selectable = {
      id: makeId("sel"),
      name: "",
      description: "",
      mode: "single",
      options: [{ id: makeId("opt"), name: "", description: "" }],
    };
    persist([...read(), fresh]);
    return fresh.id;
  }, [persist]);

  const duplicate = useCallback(
    (id: string) => {
      const src = read().find((s) => s.id === id);
      if (!src) return;
      const copy: Selectable = {
        ...src,
        id: makeId("sel"),
        name: `${src.name} (copia)`,
        options: src.options.map((o) => ({ ...o, id: makeId("opt") })),
      };
      persist([...read(), copy]);
    },
    [persist]
  );

  const remove = useCallback(
    (id: string) => {
      persist(read().filter((s) => s.id !== id));
    },
    [persist]
  );

  const addOption = useCallback(
    (id: string) => {
      persist(
        read().map((s) =>
          s.id === id
            ? {
                ...s,
                options: [
                  ...s.options,
                  { id: makeId("opt"), name: "", description: "" },
                ],
              }
            : s
        )
      );
    },
    [persist]
  );

  const updateOption = useCallback(
    (id: string, optionId: string, patch: Partial<Omit<SelectableOption, "id">>) => {
      persist(
        read().map((s) =>
          s.id === id
            ? {
                ...s,
                options: s.options.map((o) =>
                  o.id === optionId ? { ...o, ...patch } : o
                ),
              }
            : s
        )
      );
    },
    [persist]
  );

  const removeOption = useCallback(
    (id: string, optionId: string) => {
      persist(
        read().map((s) =>
          s.id === id
            ? { ...s, options: s.options.filter((o) => o.id !== optionId) }
            : s
        )
      );
    },
    [persist]
  );

  const setMode = useCallback(
    (id: string, mode: SelectionMode) => update(id, { mode }),
    [update]
  );

  const resetToDefaults = useCallback(() => {
    persist(defaultSelectables());
  }, [persist]);

  return {
    selectables,
    hydrated,
    add,
    save,
    duplicate,
    remove,
    update,
    setMode,
    addOption,
    updateOption,
    removeOption,
    resetToDefaults,
  };
}
