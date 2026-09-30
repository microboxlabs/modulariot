"use client";
import { useState } from "react";
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
export function ServerDashboardQueries({
  editable,
  dictionary,
  ...options
}: Readonly<Props>) {
  const [open, setOpen] = useState(false);
  const { queries, setQueries } = useDashboard();
  const catalog = useQueryCatalog({ ...options, enabled: open && editable });
  const t = (key: string) => tr(`dashboard.server.queries.${key}`, dictionary);
  if (!editable) return null;
  function close() {
    if (globalThis.confirm(t("discard"))) setOpen(false);
  }
  function reload() {
    if (globalThis.confirm(t("discard"))) catalog.reload();
  }
  return (
    <section className="space-y-3 border-b p-3" aria-label={t("title")}>
      <Button size="sm" color="light" onClick={() => setOpen(true)}>
        {t("title")}
      </Button>
      {open && (
        <>
          <p>{t("hint")}</p>
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
          <div className="flex gap-2">
            <Button
              size="sm"
              color="light"
              disabled={catalog.loading}
              onClick={reload}
            >
              {t("reload")}
            </Button>
            <Button size="sm" color="light" onClick={close}>
              {t("close")}
            </Button>
          </div>
        </>
      )}
    </section>
  );
}
