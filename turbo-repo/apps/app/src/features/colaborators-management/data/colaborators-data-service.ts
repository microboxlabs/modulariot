import type { Colaborator, ColaboratorKpi } from "../types/colaborators.types";
import { colaborators as mockColaborators, colaboratorsKpis as mockKpis } from "./colaborators-mock-data";

/**
 * Colaborators Data Service
 * 
 * This service provides access to colaborator data.
 * Currently uses mock data but can be replaced with API/database calls.
 */

/**
 * Get all colaborators
 * @returns Promise resolving to array of colaborators
 */
export async function getColaborators(): Promise<Colaborator[]> {
  // TODO: Replace with actual API call
  // return fetch('/api/colaborators').then(res => res.json());
  return Promise.resolve(mockColaborators);
}

/**
 * Get colaborators synchronously (for client-side use)
 * @returns Array of colaborators
 */
export function getColaboratorsSync(): Colaborator[] {
  // TODO: Replace with cached data from SWR/React Query
  return mockColaborators;
}

/**
 * Get a single colaborator by ID
 * @param id - The colaborator ID
 * @returns Promise resolving to colaborator or undefined
 */
export async function getColaboratorById(id: string): Promise<Colaborator | undefined> {
  // TODO: Replace with actual API call
  // return fetch(`/api/colaborators/${id}`).then(res => res.json());
  const colaborator = mockColaborators.find((c) => c.id === id);
  return Promise.resolve(colaborator);
}

/**
 * Get a single colaborator by ID synchronously
 * @param id - The colaborator ID
 * @returns Colaborator or undefined
 */
export function getColaboratorByIdSync(id: string): Colaborator | undefined {
  return mockColaborators.find((c) => c.id === id);
}

/**
 * Get colaborator KPIs
 * @returns Promise resolving to array of KPIs
 */
export async function getColaboratorsKpis(): Promise<ColaboratorKpi[]> {
  // TODO: Replace with actual API call
  return Promise.resolve(mockKpis);
}

/**
 * Get colaborator KPIs synchronously
 * @returns Array of KPIs
 */
export function getColaboratorsKpisSync(): ColaboratorKpi[] {
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
    return { previousId: null, nextId: null, currentIndex: -1, total: colaborators.length };
  }

  return {
    previousId: currentIndex > 0 ? colaborators[currentIndex - 1].id : null,
    nextId: currentIndex < colaborators.length - 1 ? colaborators[currentIndex + 1].id : null,
    currentIndex,
    total: colaborators.length,
  };
}
