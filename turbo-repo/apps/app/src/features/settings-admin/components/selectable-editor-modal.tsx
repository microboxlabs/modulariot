"use client";

import { useEffect, useState } from "react";
import { HiOutlinePlus, HiOutlineTrash } from "react-icons/hi";
import AbsoluteModal from "@/features/common/components/absolute-modal/absolute-modal";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import { makeId } from "../selectables/store";
import type { Selectable, SelectableOption, SelectionMode } from "../selectables/types";

function emptyDraft(): Selectable {
  return {
    id: makeId("sel"),
    name: "",
    description: "",
    mode: "single",
    options: [{ id: makeId("opt"), name: "", description: "" }],
  };
}

interface SelectableEditorModalProps {
  readonly show: boolean;
  readonly onClose: () => void;
  /** The selectable being edited, or `null` to create a new one. */
  readonly editing: Selectable | null;
  readonly onSave: (selectable: Selectable) => void;
  readonly onDelete?: (id: string) => void;
  readonly dict: I18nRecord;
}

/**
 * PROTOTYPE — the create/edit surface for one Selectable.
 *
 * Holds its own draft in local state; nothing reaches the store until
 * "Guardar", so closing or cancelling a half-filled create (or a botched
 * edit) never leaves the list dirty. Opened from the page's "Nuevo
 * seleccionable" button, its row "Editar" actions, and the gear picker's
 * "Crear seleccionable" link (`?new=1`, see `selectables-page-content.tsx`).
 */
export default function SelectableEditorModal({
  show,
  onClose,
  editing,
  onSave,
  onDelete,
  dict,
}: SelectableEditorModalProps) {
  const d = dict?.selectables as I18nRecord;
  const [draft, setDraft] = useState<Selectable>(() => editing ?? emptyDraft());

  // Re-seed the draft every time the modal opens, from whichever selectable
  // (or blank template) it was opened for — not on every keystroke re-render.
  useEffect(() => {
    if (show) setDraft(editing ?? emptyDraft());
  }, [show, editing]);

  const isEditMode = editing !== null;
  const canSave = draft.name.trim().length > 0;

  const updateOption = (
    optionId: string,
    patch: Partial<Omit<SelectableOption, "id">>
  ) => {
    setDraft((prev) => ({
      ...prev,
      options: prev.options.map((o) =>
        o.id === optionId ? { ...o, ...patch } : o
      ),
    }));
  };

  const addOption = () => {
    setDraft((prev) => ({
      ...prev,
      options: [...prev.options, { id: makeId("opt"), name: "", description: "" }],
    }));
  };

  const removeOption = (optionId: string) => {
    setDraft((prev) => ({
      ...prev,
      options: prev.options.filter((o) => o.id !== optionId),
    }));
  };

  const inputBase =
    "w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-900 dark:text-white";

  return (
    <AbsoluteModal
      selected={show}
      setSelected={onClose}
      maxWidth="36rem"
      height="min(90vh, 640px)"
      className="w-full rounded-2xl border border-gray-200 bg-white text-left shadow-2xl dark:border-gray-700 dark:bg-gray-800"
    >
      <div className="flex h-full w-full flex-col">
        <div className="shrink-0 border-b border-gray-200 px-6 py-4 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            {isEditMode ? tr("editTitle", d) : tr("newSelectable", d)}
          </h2>
          <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
            {tr("savedHint", d)}
          </p>
        </div>

        <div className="flex flex-1 min-h-0 flex-col gap-5 overflow-y-auto px-6 py-5">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-900 dark:text-white">
              {tr("nameLabel", d)}
            </label>
            <input
              autoFocus
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              placeholder={tr("namePlaceholder", d)}
              className={inputBase}
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-900 dark:text-white">
              {tr("descriptionLabel", d)}
            </label>
            <textarea
              value={draft.description}
              onChange={(e) => setDraft({ ...draft, description: e.target.value })}
              placeholder={tr("descriptionPlaceholder", d)}
              rows={2}
              className={inputBase}
            />
          </div>

          <div>
            <span className="mb-1 block text-sm font-medium text-gray-900 dark:text-white">
              {tr("modeLabel", d)}
            </span>
            <div className="inline-flex rounded-md border border-gray-300 p-0.5 text-xs font-medium dark:border-gray-600">
              {(["single", "multiple"] as SelectionMode[]).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setDraft({ ...draft, mode })}
                  className={`rounded px-3 py-1.5 transition-colors ${
                    draft.mode === mode
                      ? "bg-blue-600 text-white"
                      : "text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
                  }`}
                >
                  {mode === "single" ? tr("modeSingle", d) : tr("modeMultiple", d)}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between border-b border-gray-200 pb-2 dark:border-gray-700">
              <span className="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                {tr("optionsTitle", d)}
              </span>
              <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-600 dark:bg-gray-700 dark:text-gray-300">
                {tr("optionsCount", d, { count: String(draft.options.length) })}
              </span>
            </div>

            {draft.options.map((option, index) => (
              <div
                key={option.id}
                className="flex items-start gap-2 rounded-md border border-gray-200 px-3 py-2.5 dark:border-gray-700"
              >
                <span className="mt-2 w-4 shrink-0 text-center text-xs text-gray-400 dark:text-gray-500">
                  {index + 1}
                </span>
                <div className="flex flex-1 flex-col gap-2 sm:flex-row">
                  <input
                    value={option.name}
                    onChange={(e) =>
                      updateOption(option.id, { name: e.target.value })
                    }
                    placeholder={tr("optionNamePlaceholder", d)}
                    className={`${inputBase} sm:w-2/5`}
                  />
                  <input
                    value={option.description}
                    onChange={(e) =>
                      updateOption(option.id, { description: e.target.value })
                    }
                    placeholder={tr("optionDescPlaceholder", d)}
                    className={`${inputBase} sm:flex-1`}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => removeOption(option.id)}
                  title={tr("removeOption", d)}
                  className="mt-1 shrink-0 rounded-md p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/30 dark:hover:text-red-400"
                >
                  <HiOutlineTrash className="h-4 w-4" />
                </button>
              </div>
            ))}

            <button
              type="button"
              onClick={addOption}
              className="inline-flex w-fit items-center gap-1.5 rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800"
            >
              <HiOutlinePlus className="h-3.5 w-3.5" />
              {tr("addOption", d)}
            </button>
          </div>
        </div>

        <div className="flex shrink-0 items-center justify-between gap-2 border-t border-gray-200 px-6 py-4 dark:border-gray-700">
          {isEditMode && onDelete ? (
            <button
              type="button"
              onClick={() => {
                onDelete(draft.id);
                onClose();
              }}
              className="inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
            >
              <HiOutlineTrash className="h-4 w-4" />
              {tr("removeSelectable", d)}
            </button>
          ) : (
            <span />
          )}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800"
            >
              {tr("cancel", d)}
            </button>
            <button
              type="button"
              disabled={!canSave}
              onClick={() => {
                onSave(draft);
                onClose();
              }}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {tr("save", d)}
            </button>
          </div>
        </div>
      </div>
    </AbsoluteModal>
  );
}
