"use client";

import { ConfirmModal } from "@/features/dashboard/components/confirm-modal";
import { trDynamic } from "@/features/i18n/tr.service";
import type { PropsWithI18nDict } from "@/features/i18n/i18n.service.types";
import type { PendingConfirm } from "./use-explorer-actions";

interface ExplorerConfirmDialogProps {
  pending: PendingConfirm | null;
  onConfirm: () => void;
  onCancel: () => void;
}

function deleteText(
  pending: Extract<PendingConfirm, { kind: "delete" }>,
  t: (key: string, params?: Record<string, string>) => string
) {
  return {
    title:
      pending.ids.length === 1
        ? t("confirm.deleteTitle", { name: pending.name })
        : t("confirm.deleteManyTitle", { count: String(pending.ids.length) }),
    description:
      pending.inside > 0
        ? t("confirm.deleteFolderBody", { count: String(pending.inside) })
        : t("confirm.deleteBody"),
    confirmText: t("menu.delete"),
  };
}

function moveDescription(
  pending: Extract<PendingConfirm, { kind: "move" }>,
  t: (key: string, params?: Record<string, string>) => string
): string {
  if (pending.targetName === null) return t("confirm.moveToTop");
  return t("confirm.moveInto", { target: pending.targetName });
}

function moveTitle(
  pending: Extract<PendingConfirm, { kind: "move" }>,
  t: (key: string, params?: Record<string, string>) => string
): string {
  if (pending.ids.length === 1) {
    return t("confirm.moveTitle", { name: pending.name });
  }
  return t("confirm.moveManyTitle", { count: String(pending.ids.length) });
}

/** The confirmations for delete and for a drag-and-drop move. */
export default function ExplorerConfirmDialog({
  pending,
  onConfirm,
  onCancel,
  dict,
}: Readonly<PropsWithI18nDict<ExplorerConfirmDialogProps>>) {
  const t = (key: string, params?: Record<string, string>) =>
    trDynamic(`explorer.${key}`, dict, params);
  const cancelText = t("confirm.cancel");

  if (pending?.kind === "delete") {
    return (
      <ConfirmModal
        isOpen
        onClose={onCancel}
        onConfirm={onConfirm}
        cancelText={cancelText}
        {...deleteText(pending, t)}
      />
    );
  }

  if (pending?.kind === "move") {
    return (
      <ConfirmModal
        isOpen
        onClose={onCancel}
        onConfirm={onConfirm}
        title={moveTitle(pending, t)}
        description={moveDescription(pending, t)}
        confirmText={t("confirm.move")}
        cancelText={cancelText}
        confirmColor="blue"
      />
    );
  }

  return null;
}
