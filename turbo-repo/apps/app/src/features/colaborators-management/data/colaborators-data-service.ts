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
  // TODO: replace with fetch('/api/colaborators') when API is ready
  return mockColaborators;
}

/**
 * Get a single colaborator by ID
 * @param id - The colaborator ID
 * @returns Colaborator or undefined
 */
export function getColaboratorById(id: string): Colaborator | undefined {
  // TODO: replace with fetch(`/api/colaborators/${id}`) when API is ready
  return mockColaborators.find((c) => c.id === id);
}

/**
 * Get colaborator KPIs
 * @returns Array of KPIs
 */
export function getColaboratorsKpis(): ColaboratorKpi[] {
  // TODO: replace with API call when ready
  return mockKpis;
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
