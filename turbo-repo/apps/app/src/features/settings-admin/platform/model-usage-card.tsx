"use client";

import { useMemo, useState, type ReactNode } from "react";
import { Select, Spinner } from "flowbite-react";
import { HiOutlineChartBar } from "react-icons/hi";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import { monthPeriod } from "./model-provider-form";
import { useModelUsage } from "./use-model-providers";

interface ModelUsageCardProps {
  readonly dict: I18nRecord;
  readonly lang: string;
}

/** Tokens and cost per organization and model, for this month or the last. */
export default function ModelUsageCard({ dict, lang }: ModelUsageCardProps) {
  const [offset, setOffset] = useState(0);
  const { from, to } = useMemo(() => monthPeriod(offset), [offset]);
  const { totals, isLoading, error } = useModelUsage(from, to);

  const numbers = new Intl.NumberFormat(lang);
  const money = new Intl.NumberFormat(lang, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 4,
  });
  const totalCost = totals.reduce((sum, t) => sum + (t.costUsd ?? 0), 0);
  const unpriced = totals.reduce((sum, t) => sum + t.unpricedRuns, 0);

  function renderBody(): ReactNode {
    if (isLoading) return <Spinner size="sm" />;
    if (error) {
      return (
        <p className="text-sm text-red-600 dark:text-red-400">
          {tr("loadError", dict)}
        </p>
      );
    }
    if (totals.length === 0) {
      return (
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {tr("empty", dict)}
        </p>
      );
    }
    return (
      <>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-gray-600 dark:text-gray-300">
            <thead className="text-gray-500 dark:text-gray-400">
              <tr>
                <th className="py-1 pr-3 font-medium">
                  {tr("columns.organization", dict)}
                </th>
                <th className="py-1 pr-3 font-medium">
                  {tr("columns.model", dict)}
                </th>
                <th className="py-1 pr-3 text-right font-medium">
                  {tr("columns.runs", dict)}
                </th>
                <th className="py-1 pr-3 text-right font-medium">
                  {tr("columns.input", dict)}
                </th>
                <th className="py-1 pr-3 text-right font-medium">
                  {tr("columns.output", dict)}
                </th>
                <th className="py-1 text-right font-medium">
                  {tr("columns.cost", dict)}
                </th>
              </tr>
            </thead>
            <tbody>
              {totals.map((t) => (
                <tr
                  key={`${t.organization ?? ""}/${t.provider}/${t.model}`}
                  className="border-t border-gray-100 dark:border-gray-700"
                >
                  <td className="py-1 pr-3">
                    {t.organization ?? tr("noOrganization", dict)}
                  </td>
                  <td className="py-1 pr-3 font-mono">
                    {t.provider}:{t.model}
                  </td>
                  <td className="py-1 pr-3 text-right">
                    {numbers.format(t.runs)}
                  </td>
                  <td className="py-1 pr-3 text-right">
                    {numbers.format(
                      t.inputTokens + t.cacheReadTokens + t.cacheWriteTokens
                    )}
                  </td>
                  <td className="py-1 pr-3 text-right">
                    {numbers.format(t.outputTokens)}
                  </td>
                  <td className="py-1 text-right">
                    {t.costUsd == null ? "—" : money.format(t.costUsd)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-gray-200 font-semibold text-gray-900 dark:border-gray-600 dark:text-white">
                <td className="py-1" colSpan={5}>
                  {tr("total", dict)}
                </td>
                <td className="py-1 text-right">{money.format(totalCost)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
        {unpriced > 0 && (
          <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">
            {tr("unpriced", dict, { count: String(unpriced) })}
          </p>
        )}
      </>
    );
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
      <div className="flex flex-wrap items-center gap-2">
        <HiOutlineChartBar className="h-5 w-5 text-blue-500" />
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
          {tr("title", dict)}
        </h3>
        <Select
          sizing="sm"
          className="ml-auto"
          aria-label={tr("period", dict)}
          value={String(offset)}
          onChange={(e) => setOffset(Number(e.target.value))}
        >
          <option value="0">{tr("thisMonth", dict)}</option>
          <option value="-1">{tr("lastMonth", dict)}</option>
        </Select>
      </div>
      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
        {tr("description", dict)}
      </p>
      <div className="mt-3">{renderBody()}</div>
    </div>
  );
}
