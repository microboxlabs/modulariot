"use client";

import { useState, useEffect } from "react";
import { SymptomsICUItemResponse } from "@/app/api/symptoms/icu/route.type";

export function useSymptomsIcu(condition?: string) {
  const [icuData, setIcuData] = useState<SymptomsICUItemResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    async function fetchIcuData() {
      try {
        setLoading(true);
        const response = await fetch("/app/api/symptoms/icu");
        if (!response.ok) throw new Error("Failed to fetch ICU data");

        const data = await response.json();
        // Filter by condition if provided
        const filteredData = condition
          ? data.filter(
              (item: SymptomsICUItemResponse) =>
                item.icu_condition.toLowerCase().replaceAll(" ", "_") ===
                condition.toLowerCase(),
            )
          : data;

        setIcuData(filteredData);
      } catch (err) {
        setError(
          err instanceof Error ? err : new Error("Failed to fetch ICU data"),
        );
      } finally {
        setLoading(false);
      }
    }

    fetchIcuData();
  }, [condition]);

  return { icuData, loading, error };
}
