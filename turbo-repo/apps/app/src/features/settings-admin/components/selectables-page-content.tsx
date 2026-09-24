"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { IconType } from "react-icons";
import {
  HiOutlineViewList,
  HiViewGridAdd,
  HiOutlineTrash,
  HiOutlineDuplicate,
  HiOutlinePencil,
  HiPlus,
  HiRefresh,
} from "react-icons/hi";
import { Breadcrumb } from "@/features/common/components/Breadcrumb/Breadcrumb";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import { useSelectables } from "../selectables/store";
import type { Selectable } from "../selectables/types";
import SelectableEditorModal from "./selectable-editor-modal";

interface SelectablesPageContentProps {
  readonly dict: I18nRecord;
  readonly lang: string;
}

/** Same rounded tile the harness settings page uses for section headers. */
function IconTile({ icon: Icon }: { readonly icon: IconType }) {
  return (
    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-700">
      <Icon className="h-5 w-5 text-gray-500 dark:text-gray-400" />
    </div>
  );
}

/**
 * Settings › Selectables.
 *
 * A read-only summary list, laid out with the harness settings page's shell
 * and card system. Creating or editing a list happens in
 * `SelectableEditorModal`, reached via "Nuevo seleccionable", a row's
 * "Editar", or the gear picker's "Crear seleccionable" link (`?new=1`).
 */
export default function SelectablesPageContent({
  dict,
  lang,
}: SelectablesPageContentProps) {
  const d = dict?.selectables as I18nRecord;
  const breadcrumbDict = dict?.breadcrumb as I18nRecord;
  const { selectables, hydrated, save, duplicate, remove, resetToDefaults } =
    useSelectables();

  const router = useRouter();
  const searchParams = useSearchParams();
  const openedFromLink = useRef(false);

  const [editing, setEditing] = useState<Selectable | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const openCreate = () => {
    setEditing(null);
    setModalOpen(true);
  };
  const openEdit = (selectable: Selectable) => {
    setEditing(selectable);
    setModalOpen(true);
  };

  // The gear picker's "Create selectable" link lands here with ?new=1 — open
  // the create modal, then strip the param so a refresh doesn't reopen it.
  useEffect(() => {
    if (!hydrated || openedFromLink.current) return;
    if (searchParams.get("new") !== "1") return;
    openedFromLink.current = true;
    openCreate();
    router.replace(`/${lang}/users/settings/selectables`);
  }, [hydrated, searchParams, router, lang]);

  return (
    <div className="flex h-full w-full flex-col overflow-hidden">
      <div className="flex w-full items-center justify-between border-b border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-900 dark:text-white">
        <Breadcrumb
          dict={breadcrumbDict}
          lang={lang}
          path={["user", "settings", "selectables"]}
          disableLinks
        />
      </div>

      <div className="mx-auto flex w-full max-w-screen-2xl flex-1 min-h-0 flex-col gap-4 overflow-y-auto px-4 pt-2 pb-10 dark:bg-gray-900">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <IconTile icon={HiOutlineViewList} />
            <div>
              <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
                {tr("title", d)}
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {tr("description", d)}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={resetToDefaults}
              className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800"
            >
              <HiRefresh className="h-4 w-4" />
              {tr("resetSeed", d)}
            </button>
            <button
              type="button"
              onClick={openCreate}
              className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              <HiPlus className="h-4 w-4" />
              {tr("newSelectable", d)}
            </button>
          </div>
        </div>

        {hydrated && selectables.length === 0 && (
          <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-gray-300 px-4 py-16 text-center dark:border-gray-700">
            <IconTile icon={HiViewGridAdd} />
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {tr("empty", d)}
            </p>
          </div>
        )}

        {selectables.map((selectable) => (
          <section
            key={selectable.id}
            className="flex flex-col rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800"
          >
            <div className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 items-center gap-3">
                <IconTile icon={HiOutlineViewList} />
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="truncate text-sm font-semibold text-gray-900 dark:text-white">
                      {selectable.name || tr("namePlaceholder", d)}
                    </h2>
                    <span className="shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600 dark:bg-gray-700 dark:text-gray-300">
                      {selectable.mode === "multiple"
                        ? tr("modeMultiple", d)
                        : tr("modeSingle", d)}
                    </span>
                    <span className="shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600 dark:bg-gray-700 dark:text-gray-300">
                      {tr("optionsCount", d, {
                        count: String(selectable.options.length),
                      })}
                    </span>
                  </div>
                  {selectable.description && (
                    <p className="mt-0.5 truncate text-xs text-gray-500 dark:text-gray-400">
                      {selectable.description}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2 self-start sm:self-center">
                <button
                  type="button"
                  onClick={() => openEdit(selectable)}
                  className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
                >
                  <HiOutlinePencil className="h-3.5 w-3.5" />
                  {tr("edit", d)}
                </button>
                <button
                  type="button"
                  onClick={() => duplicate(selectable.id)}
                  title={tr("duplicate", d)}
                  className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-200"
                >
                  <HiOutlineDuplicate className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => remove(selectable.id)}
                  title={tr("removeSelectable", d)}
                  className="rounded-md p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/30 dark:hover:text-red-400"
                >
                  <HiOutlineTrash className="h-4 w-4" />
                </button>
              </div>
            </div>

            {selectable.options.length > 0 && (
              <div className="flex flex-wrap gap-1.5 border-t border-gray-100 px-4 py-3 dark:border-gray-700/60">
                {selectable.options.map((option) => (
                  <span
                    key={option.id}
                    className="truncate rounded-full bg-gray-100 px-2.5 py-1 text-xs text-gray-600 dark:bg-gray-700 dark:text-gray-300"
                  >
                    {option.name || tr("optionNamePlaceholder", d)}
                  </span>
                ))}
              </div>
            )}
          </section>
        ))}
      </div>

      <SelectableEditorModal
        show={modalOpen}
        onClose={() => setModalOpen(false)}
        editing={editing}
        onSave={save}
        onDelete={remove}
        dict={dict}
      />
    </div>
  );
}
