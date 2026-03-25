import { useMemo, useCallback } from "react";
import type { TableColumn } from "./column-types";
import { compileTemplates, resolveTemplate } from "./use-handlebars-templates";

/**
 * Pre-compiles Handlebars templates for column keys, labels, and types,
 * and provides resolve helpers shared by data_list and data_table dashlets.
 */
export function useCompiledColumns(columns: TableColumn[], rowCount: number) {
  const compiledKeys = useMemo(
    () => compileTemplates(columns.map((c) => ({ id: c.key, template: c.key }))),
    [columns]
  );

  const compiledLabels = useMemo(
    () => compileTemplates(columns.map((c) => ({ id: c.key, template: c.label }))),
    [columns]
  );

  const compiledTypes = useMemo(
    () => compileTemplates(columns.map((c) => ({ id: c.key, template: c.type }))),
    [columns]
  );

  const resolveValue = useCallback(
    (key: string, row: Record<string, string>, rowIdx: number, totalRows: number): string =>
      resolveTemplate(compiledKeys, key, { ...row, row, _index: rowIdx, _count: totalRows }, row[key] ?? key),
    [compiledKeys]
  );

  const resolveLabel = useCallback(
    (key: string): string =>
      resolveTemplate(compiledLabels, key, { _count: rowCount }, columns.find((c) => c.key === key)?.label ?? key),
    [compiledLabels, rowCount, columns]
  );

  const resolveType = useCallback(
    (key: string, row: Record<string, string>, rowIdx: number, totalRows: number): string => {
      const col = columns.find((c) => c.key === key);
      const result = resolveTemplate(
        compiledTypes, key,
        { ...row, row, _index: rowIdx, _count: totalRows },
        col?.type || "text"
      );
      return result.trim() || "text";
    },
    [compiledTypes, columns]
  );

  return { resolveValue, resolveLabel, resolveType };
}
