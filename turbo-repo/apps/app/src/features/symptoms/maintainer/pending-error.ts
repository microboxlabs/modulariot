import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import { ControlTowerError } from "../control-tower/control-tower-api";

/** Why a revert or a copy failed, in the page's language. */
export function pendingError(
  e: unknown,
  kind: "rollback" | "fork",
  d: I18nRecord
) {
  const status = e instanceof ControlTowerError ? e.status : null;
  if (kind === "fork" && status === 409) return tr("nameTaken", d);
  if (status === 403) return tr("ownersOnlyChange", d);
  return tr("actionFailed", d);
}
