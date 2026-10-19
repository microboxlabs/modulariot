"use client";
import { Button } from "flowbite-react";
import {
  SavedQueryManager,
  useQueryCatalog,
  type QueryCatalogOptions,
} from "@microboxlabs/miot-dashboard-ui/react";
import { useDashboard } from "../context/dashboard-context";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";

type Props = Omit<QueryCatalogOptions, "enabled"> & {
  editable: boolean;
  dictionary: I18nRecord;
};
/** Saved-query authoring for the gear menu; the catalog loads when this mounts. */
export function ServerDashboardQueries({
  editable,
  dictionary,
  ...options
}: Readonly<Props>) {
  const { queries, setQueries } = useDashboard();
  const catalog = useQueryCatalog({ ...options, enabled: editable });
  const t = (key: string) => tr(`dashboard.server.queries.${key}`, dictionary);
  if (!editable) return null;
  function reload() {
    if (globalThis.confirm(t("discard"))) catalog.reload();
  }
  return (
    <div className="space-y-3 p-4">
      {catalog.loading && <output>{t("loading")}</output>}
      {catalog.error !== null && <p role="alert">{t("catalogError")}</p>}
      {catalog.loaded && (
        <SavedQueryManager
          key={catalog.editorKey}
          queries={queries}
          connections={catalog.connections}
          onChange={setQueries}
          editable={editable}
          labels={{
            name: t("name"),
            connection: t("connection"),
            operation: t("operation"),
            parameters: t("parameters"),
            parametersHint: t("parametersHint"),
            choose: t("choose"),
            unavailable: t("unavailable"),
            invalid: t("invalid"),
            duplicate: t("duplicate"),
            save: t("apply"),
            add: t("add"),
            close: t("closeDraft"),
            remove: t("remove"),
            confirmRemove: t("confirmRemove"),
            cancel: t("cancel"),
            empty: t("empty"),
            rejected: t("rejected"),
          }}
        />
      )}
      <Button
        size="sm"
        color="light"
        disabled={catalog.loading}
        onClick={reload}
      >
        {t("reload")}
      </Button>
    </div>
  );
}
