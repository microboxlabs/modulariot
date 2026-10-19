import { ActionDropdown } from "./action-dropdown";
import { isSafeActionUrl } from "./action-helpers";
import { resolveHandlebarsField } from "./use-handlebars-templates";
import type { ActionsConfig } from "./action-types";
import { tr } from "@/features/i18n/tr.service";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";

export function tableStatusLabels(dictionary: I18nRecord, fetchError: string | null, actionsLabel: string) {
  return {
    loadingLabel: tr("dashboard.settings.tableLoading", dictionary),
    errorLabel: fetchError ? tr("dashboard.settings.tableError", dictionary, { fetchError }) : undefined,
    emptyLabel: tr("dashboard.settings.tableNoData", dictionary),
    actionsLabel,
  };
}

export function tableRowActions(actions: ActionsConfig, label: string) {
  if (!actions.enabled || actions.items.length === 0) return undefined;
  return function renderRowActions(row: Record<string, string>) { return <ActionDropdown ariaLabel={label} items={actions.items.flatMap(action => {
    const href = resolveHandlebarsField(action.link, { ...row, row });
    return isSafeActionUrl(href) ? [{ action, href }] : [];
  })}/>; };
}
