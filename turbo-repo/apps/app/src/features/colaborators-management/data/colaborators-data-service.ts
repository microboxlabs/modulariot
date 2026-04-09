import {
  HiOutlineUserGroup,
  HiOutlineStar,
  HiOutlineExclamationTriangle,
  HiOutlineTrophy,
  HiOutlineDocumentText,
  HiOutlineChartBar,
} from "react-icons/hi2";
import type { Colaborator, ColaboratorKpi } from "../types/colaborators.types";
import {
  colaborators as mockColaborators,
  colaboratorsKpis as mockKpis,
} from "./colaborators-mock-data";

/**
 * Colaborators Data Service
 *
 * This service provides access to colaborator data.
 * Currently uses mock data but can be replaced with API/database calls.
 */

/**
 * Get all colaborators
 * @returns Array of colaborators
 */
export function getColaborators(): Colaborator[] {
  return mockColaborators;
}

/**
 * Get a single colaborator by ID
 * @param id - The colaborator ID
 * @returns Colaborator or undefined
 */
export function getColaboratorById(id: string): Colaborator | undefined {
  return mockColaborators.find((c) => c.id === id);
}

/**
 * Get colaborator KPIs (legacy hardcoded mock values).
 *
 * Prefer `computeColaboratorsKpis(list)` — it derives every card from the
 * actual list so the numbers can't drift from what the grid shows.
 */
export function getColaboratorsKpis(): ColaboratorKpi[] {
  return mockKpis;
}

/**
 * Derive the KPI card row from the current colaborators list.
 *
 * All six cards are computed from the list so the row stays in sync with
 * whatever the grid is showing — previously the `total` card was hardcoded
 * to 256 (the mock-data length) and drifted as soon as the backend started
 * returning a different number of rows.
 *
 * Semantics per card:
 * - `total`               — `list.length`
 * - `averageScore`        — mean of `score` (1 decimal), `—` when empty
 * - `driversAtRisk`       — % of rows with `score < 50`
 * - `outstandingDrivers`  — % of rows with `score >= 80`
 * - `incidentsLast30Days` — sum of `incidentsCount`
 * - `averageEfficiency`   — mean of `punctuality` (% with 1 decimal)
 *
 * The icon/color styling stays identical to the legacy hardcoded values
 * so the visual layout doesn't change.
 */
export function computeColaboratorsKpis(
  list: Colaborator[]
): ColaboratorKpi[] {
  const total = list.length;

  const formatPct = (n: number) => `${n.toFixed(1)}%`;
  const safeMean = (sum: number) => (total > 0 ? sum / total : 0);

  const avgScore = safeMean(list.reduce((acc, c) => acc + c.score, 0));
  const avgPunctuality = safeMean(
    list.reduce((acc, c) => acc + c.punctuality, 0)
  );
  const atRiskCount = list.filter((c) => c.score < 50).length;
  const outstandingCount = list.filter((c) => c.score >= 80).length;
  const incidentsTotal = list.reduce((acc, c) => acc + c.incidentsCount, 0);

  const atRiskPct = total > 0 ? (atRiskCount / total) * 100 : 0;
  const outstandingPct = total > 0 ? (outstandingCount / total) * 100 : 0;

  return [
    {
      id: "total",
      labelKey: "totalColaborators",
      value: total,
      icon: HiOutlineUserGroup,
      color: "text-blue-600 bg-blue-100",
      darkColor: "dark:text-blue-400 dark:bg-blue-900/30",
    },
    {
      id: "avgScore",
      labelKey: "averageScore",
      value: total > 0 ? Number(avgScore.toFixed(1)) : "—",
      icon: HiOutlineStar,
      color: "text-amber-600 bg-amber-100",
      darkColor: "dark:text-amber-400 dark:bg-amber-900/30",
    },
    {
      id: "atRisk",
      labelKey: "driversAtRisk",
      value: formatPct(atRiskPct),
      icon: HiOutlineExclamationTriangle,
      color: "text-red-600 bg-red-100",
      darkColor: "dark:text-red-400 dark:bg-red-900/30",
    },
    {
      id: "outstanding",
      labelKey: "outstandingDrivers",
      value: formatPct(outstandingPct),
      icon: HiOutlineTrophy,
      color: "text-green-600 bg-green-100",
      darkColor: "dark:text-green-400 dark:bg-green-900/30",
    },
    {
      id: "incidents",
      labelKey: "incidentsLast30Days",
      value: incidentsTotal,
      icon: HiOutlineDocumentText,
      color: "text-orange-600 bg-orange-100",
      darkColor: "dark:text-orange-400 dark:bg-orange-900/30",
    },
    {
      id: "efficiency",
      labelKey: "averageEfficiency",
      value: total > 0 ? formatPct(avgPunctuality) : "—",
      icon: HiOutlineChartBar,
      color: "text-teal-600 bg-teal-100",
      darkColor: "dark:text-teal-400 dark:bg-teal-900/30",
    },
  ];
}

/**
 * Get navigation info for a colaborator (previous/next)
 * @param currentId - Current colaborator ID
 * @param colaborators - Optional list of colaborators (defaults to all)
 * @returns Navigation info with previous and next colaborator IDs
 */
export function getColaboratorNavigation(
  currentId: string,
  colaborators: Colaborator[] = mockColaborators
): {
  previousId: string | null;
  nextId: string | null;
  currentIndex: number;
  total: number;
} {
  const currentIndex = colaborators.findIndex((c) => c.id === currentId);

  if (currentIndex === -1) {
    return {
      previousId: null,
      nextId: null,
      currentIndex: -1,
      total: colaborators.length,
    };
  }

  return {
    previousId: currentIndex > 0 ? colaborators[currentIndex - 1].id : null,
    nextId:
      currentIndex < colaborators.length - 1
        ? colaborators[currentIndex + 1].id
        : null,
    currentIndex,
    total: colaborators.length,
  };
}
