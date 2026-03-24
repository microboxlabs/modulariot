"use client";

import { useMemo } from "react";
import { Button, TextInput, Label, Select } from "flowbite-react";
import { HiPlus, HiTrash } from "react-icons/hi2";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import { SettingsSelectField } from "./settings-fields";
import { PgrestFunctionAutocomplete } from "./pgrest-function-autocomplete";
import { HbParamValueInput } from "./hb-param-value-input";
import { useDashboard } from "../../context/dashboard-context";
import type { usePgrestSettingsState } from "./use-pgrest-settings-state";

const stopPropagation = (e: React.MouseEvent) => e.stopPropagation();

interface DataSourceOption {
  id: string;
  name: string;
}

interface PgrestSettingsSectionProps {
  pgrest: ReturnType<typeof usePgrestSettingsState>;
  dictionary: I18nRecord;
  labels: {
    functionName: string;
    httpMethod: string;
    parameters: string;
    key: string;
    value: string;
    addParameter: string;
  };
  dataSourceId?: string;
  onDataSourceIdChange?: (id: string) => void;
  activeProviders?: DataSourceOption[];
}

export function PgrestSettingsSection({
  pgrest: pg,
  dictionary,
  labels,
  dataSourceId,
  onDataSourceIdChange,
  activeProviders,
}: Readonly<PgrestSettingsSectionProps>) {
  const { filters } = useDashboard();
  const filterSuggestions = useMemo(() => {
    const keys: string[] = [];
    let hasDateRange = false;
    for (const f of filters) {
      if (f.type === "date_range") {
        keys.push(`${f.key}_from`, `${f.key}_to`);
        hasDateRange = true;
      } else {
        keys.push(f.key);
      }
    }
    if (!hasDateRange) {
      keys.push("date_range_from", "date_range_to");
    }
    return keys;
  }, [filters]);

  return (
    <>
      {onDataSourceIdChange && (
        <div>
          <Label
            htmlFor="pgrest-data-source-provider"
            className="mb-1 block text-sm font-medium"
          >
            {tr("dashboard.settings.dataSourceProvider", dictionary)}
          </Label>
          <Select
            id="pgrest-data-source-provider"
            sizing="sm"
            value={dataSourceId ?? ""}
            onChange={(e) => {
              onDataSourceIdChange(e.target.value);
              pg.setPgrestFunctionName("");
            }}
          >
            <option value="">
              {activeProviders?.length === 0
                ? tr("dashboard.settings.noActiveProviders", dictionary)
                : tr("dashboard.settings.selectProvider", dictionary)}
            </option>
            {activeProviders?.map((ds) => (
              <option key={ds.id} value={ds.id}>
                {ds.name}
              </option>
            ))}
          </Select>
        </div>
      )}
      <div>
        <Label
          htmlFor="pgrest-fn"
          className="mb-1 block text-sm font-medium"
        >
          {labels.functionName}
        </Label>
        <PgrestFunctionAutocomplete
          id="pgrest-fn"
          value={pg.pgrestFunctionName}
          onChange={pg.setPgrestFunctionName}
          onSelect={pg.handleFunctionSelect}
          dictionary={dictionary}
          loading={pg.introspecting || pg.detecting}
          dataSourceId={dataSourceId}
        />
        {(pg.introspectError || pg.detectError) && (
          <p className="mt-1 text-xs text-red-500 dark:text-red-400">
            {pg.introspectError || pg.detectError}
          </p>
        )}
      </div>
      <SettingsSelectField
        id="pgrest-method"
        label={labels.httpMethod}
        value={pg.pgrestHttpMethod}
        onChange={(v) => pg.setPgrestHttpMethod(v as "POST" | "GET")}
        options={[
          { value: "POST", label: "POST" },
          { value: "GET", label: "GET" },
        ]}
      />
      <div>
        <Label className="mb-1.5 block text-sm font-medium">
          {labels.parameters}
        </Label>
        <div className="space-y-1.5">
          {pg.pgrestParams.map((p) => (
            <div key={p._id} className="flex items-center gap-1">
              <div className="min-w-0 flex-1">
                <TextInput
                  sizing="sm"
                  placeholder={labels.key}
                  aria-label={labels.key}
                  value={p.key}
                  onChange={(e) =>
                    pg.updatePgrestParam(p._id, "key", e.target.value)
                  }
                />
              </div>
              <div className="min-w-0 flex-1">
                <HbParamValueInput
                  placeholder={pg.paramHints[p.key] ?? labels.value}
                  value={p.value}
                  onChange={(v) =>
                    pg.updatePgrestParam(p._id, "value", v)
                  }
                  filterSuggestions={filterSuggestions}
                />
              </div>
              <button
                type="button"
                onClick={() => pg.removePgrestParam(p._id)}
                onMouseDown={stopPropagation}
                className="no-drag shrink-0 rounded p-1 text-gray-400 transition-colors hover:text-red-500 dark:text-gray-500 dark:hover:text-red-400"
              >
                <HiTrash className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
        <Button
          color="light"
          size="xs"
          onClick={pg.addPgrestParam}
          onMouseDown={stopPropagation}
          className="no-drag mt-2"
        >
          <HiPlus className="mr-1 h-3 w-3" />
          {labels.addParameter}
        </Button>
      </div>
    </>
  );
}
