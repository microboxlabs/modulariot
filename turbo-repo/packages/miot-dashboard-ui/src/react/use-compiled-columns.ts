"use client";
import { useMemo, useCallback } from "react";
import { createTemplateEngine } from "../templates";
export interface TemplateColumn {
  key: string;
  label: string;
  type: string;
}
export interface CompiledColumnsOptions {
  templateEngine?: ReturnType<typeof createTemplateEngine>;
}

/**
 * Pre-compiles Handlebars templates for column keys, labels, and types,
 * and provides resolve helpers shared by data_list and data_table dashlets.
 */
export function useCompiledColumns(
  columns: readonly TemplateColumn[],
  rowCount: number,
  options: Readonly<CompiledColumnsOptions> = {},
) {
  const engine = useMemo(
    () => options.templateEngine ?? createTemplateEngine(),
    [options.templateEngine],
  );
  const { compileTemplates, resolveTemplate } = engine;
  const compiledKeys = useMemo(
    () =>
      compileTemplates(columns.map((c) => ({ id: c.key, template: c.key }))),
    [columns, compileTemplates],
  );

  const compiledLabels = useMemo(
    () =>
      compileTemplates(columns.map((c) => ({ id: c.key, template: c.label }))),
    [columns, compileTemplates],
  );

  const compiledTypes = useMemo(
    () =>
      compileTemplates(columns.map((c) => ({ id: c.key, template: c.type }))),
    [columns, compileTemplates],
  );

  const resolveValue = useCallback(
    (
      key: string,
      row: Record<string, string>,
      rowIdx: number,
      totalRows: number,
    ): string =>
      resolveTemplate(
        compiledKeys,
        key,
        { ...row, row, _index: rowIdx, _count: totalRows },
        Object.hasOwn(row, key) ? row[key]! : key,
      ),
    [compiledKeys, resolveTemplate],
  );

  const resolveLabel = useCallback(
    (key: string): string =>
      resolveTemplate(
        compiledLabels,
        key,
        { _count: rowCount },
        columns.find((c) => c.key === key)?.label ?? key,
      ),
    [compiledLabels, rowCount, columns, resolveTemplate],
  );

  const resolveType = useCallback(
    (
      key: string,
      row: Record<string, string>,
      rowIdx: number,
      totalRows: number,
    ): string => {
      const col = columns.find((c) => c.key === key);
      const result = resolveTemplate(
        compiledTypes,
        key,
        { ...row, row, _index: rowIdx, _count: totalRows },
        col?.type || "text",
      );
      return result.trim() || "text";
    },
    [compiledTypes, columns, resolveTemplate],
  );

  return { resolveValue, resolveLabel, resolveType };
}
