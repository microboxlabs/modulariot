"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "flowbite-react";
import { HiArrowUpTray } from "react-icons/hi2";
import type { DashletComponentProps, DashletLayoutDefaults } from "../types";
import { useDashboard } from "../../context/dashboard-context";
import { tr } from "@/features/i18n/tr.service";
import { makePgrestSubmit, withValidation } from "./engine/importer";
import {
  buildRowSchema,
  validateRow,
  type IntrospectedParam,
} from "./engine/validator";
import { buildDataSourceParams } from "../common/pgrest-utils";
import { BatchImporterModal } from "./batch-importer-modal";
import { SAMPLE_TSV } from "./sample";
import type { DuplicateStrategy } from "./engine/types";

export interface DashletConfig {
  title: string;
  pgrestFunctionName: string;
  dataSourceId?: string;
  defaultStrategy: DuplicateStrategy;
  cacheKey?: string;
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

  // Fetch RPC parameter schema once per function/dataSource so rows can be
  // validated locally before hitting the network. Drift is covered by a fresh
  // fetch on remount; we intentionally do not persist params in dashlet config.
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
        // Introspection failed — fall back to server-side validation only.
        console.warn("batch_import: parameter introspection failed", err);
        setParams([]);
      });
    return () => ac.abort();
  }, [isConfigured, config.pgrestFunctionName, config.dataSourceId]);

  const schema = useMemo(
    () => (params && params.length > 0 ? buildRowSchema(params) : null),
    [params],
  );

  const validate = useMemo(() => {
    if (!schema) return undefined;
    return (fields: Record<string, string>) => validateRow(fields, schema);
  }, [schema]);

  const submit = useMemo(() => {
    if (!isConfigured) return null;
    const base = makePgrestSubmit(
      config.pgrestFunctionName,
      config.dataSourceId,
    );
    if (!schema) return base;
    return withValidation(base, schema);
  }, [isConfigured, config.pgrestFunctionName, config.dataSourceId, schema]);

  return (
    <div className="flex h-full flex-col items-center justify-center rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
      {!isConfigured && (
        <p className="text-sm text-gray-400">
          {tr("dashboard.dashlets.batchImport.configureHint", dictionary)}
        </p>
      )}

      {isConfigured && submit && (
        <>
          <Button color="blue" onClick={() => setOpen(true)}>
            <HiArrowUpTray className="mr-2 h-5 w-5" />
            {title}
          </Button>
          <BatchImporterModal
            isOpen={open}
            onClose={() => setOpen(false)}
            submit={submit}
            sourceKey={config.cacheKey || `${widget.id}:${config.pgrestFunctionName}`}
            title={title}
            defaultStrategy={config.defaultStrategy}
            sample={SAMPLE_TSV}
            acceptedFileTypes={config.acceptedFileTypes}
            dictionary={dictionary}
            validate={validate}
          />
        </>
      )}
    </div>
  );
}
