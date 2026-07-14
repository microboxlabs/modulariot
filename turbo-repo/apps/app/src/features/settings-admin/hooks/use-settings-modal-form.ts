"use client";

import { useEffect, useRef } from "react";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";

/**
 * Shared create/edit modal form helpers for Settings integration cards:
 * reset defaults only when the modal opens, and resolve chrome labels from dict.
 */
export function useSettingsModalFormOpenReset<TForm extends { name?: string }>(options: {
  show: boolean;
  isEdit: boolean;
  initial: TForm | null | undefined;
  defaults: TForm;
  dict: I18nRecord;
  reset: (values: TForm) => void;
}): void {
  const { show, isEdit, initial, defaults, dict, reset } = options;
  const wasOpen = useRef(false);

  useEffect(() => {
    if (show && !wasOpen.current) {
      reset(
        isEdit && initial
          ? initial
          : { ...defaults, name: tr("modal.defaultName", dict) },
      );
    }
    wasOpen.current = show;
  }, [show, isEdit, initial, reset, dict, defaults]);
}

export function settingsModalSubmitLabel(
  loading: boolean,
  isEdit: boolean,
  dict: I18nRecord,
): string {
  if (loading) {
    return tr("modal.saving", dict);
  }
  if (isEdit) {
    return tr("modal.saveButton", dict);
  }
  return tr("modal.createButton", dict);
}

export function settingsModalChrome(
  isEdit: boolean,
  dict: I18nRecord,
): { title: string; subtitle: string; cancelLabel: string } {
  return {
    title: isEdit ? tr("modal.editTitle", dict) : tr("modal.addTitle", dict),
    subtitle: isEdit
      ? tr("modal.editSubtitle", dict)
      : tr("modal.subtitle", dict),
    cancelLabel: tr("modal.cancel", dict),
  };
}
