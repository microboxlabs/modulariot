"use client";

import { useEffect, useState } from "react";
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

const DEBOUNCE_MS = 250;

/**
 * The organization's own fleet carriers whose name or RUT matches the query, from two characters on. The API
 * returns only this organization's carriers. `searching` is true from the keystroke until the answer for it arrives.
 */
export function useCarrierCompanies(query: string): {
  companies: CompanyOption[];
  searching: boolean;
} {
  const q = query.trim();
  const [asked, setAsked] = useState(q);
  useEffect(() => {
    const timer = setTimeout(() => setAsked(q), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [q]);
  const { data, isLoading } = useSWR(
    asked.length >= 2
      ? `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/control-tower/contact-companies?q=${encodeURIComponent(asked)}`
      : null,
    carriers,
    {
      revalidateOnFocus: false,
      shouldRetryOnError: false,
      keepPreviousData: true,
    }
  );
  if (q.length < 2) return { companies: NO_CARRIERS, searching: false };
  return {
    companies: data ?? NO_CARRIERS,
    searching: asked !== q || isLoading,
  };
}
