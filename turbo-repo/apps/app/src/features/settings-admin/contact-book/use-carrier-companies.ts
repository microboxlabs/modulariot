"use client";

import useSWR from "swr";
import { normalizeRut } from "./contact-duplicates";
import type { CompanyOption } from "./store";

interface CompanyView {
  name: string;
  rut: string | null;
}

const NO_CARRIERS: CompanyOption[] = [];

async function carriers(url: string): Promise<CompanyOption[]> {
  const res = await fetch(url);
  if (!res.ok) return NO_CARRIERS;
  const list = (await res.json()) as CompanyView[];
  return list.map((c) => ({
    name: c.name,
    rut: c.rut ? normalizeRut(c.rut) : undefined,
    source: "carrier" as const,
  }));
}

/**
 * The organization's own fleet carriers whose name or RUT matches the query, from two characters on. The API
 * returns only this organization's carriers.
 */
export function useCarrierCompanies(query: string) {
  const q = query.trim();
  const { data } = useSWR(
    q.length >= 2
      ? `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/control-tower/contact-companies?q=${encodeURIComponent(q)}`
      : null,
    carriers,
    {
      revalidateOnFocus: false,
      shouldRetryOnError: false,
      keepPreviousData: true,
    }
  );
  return q.length >= 2 ? (data ?? NO_CARRIERS) : NO_CARRIERS;
}
