"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "flowbite-react";
import { HiArrowUpTray } from "react-icons/hi2";
import type { DashletComponentProps, DashletLayoutDefaults } from "../types";
import { useDashboard } from "../../context/dashboard-context";
import { tr } from "@/features/i18n/tr.service";
import { makePgrestBatchApi } from "./engine/api";
import { buildDataSourceParams } from "../common/pgrest-utils";
import { BatchImporterModal } from "./batch-importer-modal";
import type { DuplicateStrategy, IntrospectedParam } from "./engine/types";

export interface DashletConfig {
  title: string;
  pgrestFunctionName: string;
  dataSourceId?: string;
  defaultStrategy: DuplicateStrategy;
  acceptedFileTypes?: string;
}

export const defaultConfig: DashletConfig = {
  title: "",
  pgrestFunctionName: "",
  defaultStrategy: "upsert",
};

export const layoutDefaults: DashletLayoutDefaults = {
  minW: 3,
  minH: 2,
};

export function getLayoutDefaults(): DashletLayoutDefaults {
  return layoutDefaults;
}

export function Dashlet({ widget }: Readonly<DashletComponentProps>) {
  const config = widget.config as unknown as DashletConfig;
  const { dictionary } = useDashboard();
  const [open, setOpen] = useState(false);
  const [params, setParams] = useState<IntrospectedParam[] | null>(null);

  const isConfigured = !!config.pgrestFunctionName;
  const title =
    config.title?.trim() ||
    tr("dashboard.dashlets.batchImport.defaultTitle", dictionary);

  // Fetch the parameter schema once per function/dataSource purely for the
  // schema panel UI. Validation itself runs server-side via /validate, so
  // params here is presentation-only.
  useEffect(() => {
    if (!isConfigured) {
      setParams(null);
      return;
    }
    const ac = new AbortController();
    const qs = buildDataSourceParams(config.dataSourceId);
    qs.set("fn", config.pgrestFunctionName);
    fetch(`/app/api/dashboard/pgrest/openapi?${qs.toString()}`, {
      signal: ac.signal,
    })
      .then((res) =>
        res.ok
          ? res.json()
          : Promise.reject(
              new Error(
                `OpenAPI introspection failed: ${res.status} ${res.statusText}`,
              ),
            ),
      )
      .then((data: { parameters?: IntrospectedParam[] }) => {
        setParams(data.parameters ?? []);
      })
      .catch((err) => {
        if (ac.signal.aborted) return;
        console.warn("batch_import: parameter introspection failed", err);
        setParams([]);
      });
    return () => ac.abort();
  }, [isConfigured, config.pgrestFunctionName, config.dataSourceId]);

  const api = useMemo(
    () =>
      isConfigured
        ? makePgrestBatchApi(config.pgrestFunctionName, config.dataSourceId)
        : null,
    [isConfigured, config.pgrestFunctionName, config.dataSourceId],
  );

  return (
    <div className="flex h-full flex-col items-center justify-center rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
      {!isConfigured && (
        <p className="text-sm text-gray-400">
          {tr("dashboard.dashlets.batchImport.configureHint", dictionary)}
        </p>
      )}

      {isConfigured && api && (
        <>
          <Button color="blue" onClick={() => setOpen(true)}>
            <HiArrowUpTray className="mr-2 h-5 w-5" />
            {title}
          </Button>
          <BatchImporterModal
            isOpen={open}
            onClose={() => setOpen(false)}
            api={api}
            title={title}
            defaultStrategy={config.defaultStrategy}
            acceptedFileTypes={config.acceptedFileTypes}
            dictionary={dictionary}
            params={params}
            filenameBase={config.pgrestFunctionName}
          />
        </>
      )}
    </div>
  );
}
