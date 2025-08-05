"use client";

import { useState, useEffect } from "react";

export function useTreatmentsTrip(id?: string) {
  const [treatmentsTripData, setTreatmentsTripData] = useState<any | null>(
    null,
  );
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    async function fetchTreatmentTrip() {
      try {
        setIsLoading(true);
        const response = await fetch(`/app/api/symptoms/trip?id=${id}`);

        if (!response.ok) throw new Error("Failed to fetch treatment trip");

        const data = await response.json();
        setTreatmentsTripData(data);
      } catch (err) {
        setError(
          err instanceof Error
            ? err
            : new Error("Failed to fetch treatment trip data"),
        );
      } finally {
        setIsLoading(false);
      }
    }

    fetchTreatmentTrip();
  }, [id]);

  return { treatmentsTripData, isLoading, error };
}
