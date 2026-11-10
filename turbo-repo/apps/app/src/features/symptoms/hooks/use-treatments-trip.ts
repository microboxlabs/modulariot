"use client";

import { useState, useEffect } from "react";
import {
  parseTripSymptoms,
  type TripSymptoms,
} from "@/features/symptoms/model/trip-symptoms";

/**
 * The symptom engine's cases on a trip, by symptom. The trip is its service code.
 */
export function useTreatmentsTrip(id?: string) {
  const [tripSymptoms, setTripSymptoms] = useState<TripSymptoms | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    async function fetchTreatmentTrip() {
      try {
        setIsLoading(true);
        const response = await fetch(
          `/app/api/symptoms/trip?id=${encodeURIComponent(id ?? "")}`
        );

        if (!response.ok) throw new Error("Failed to fetch treatment trip");

        setTripSymptoms(parseTripSymptoms(await response.json()));
      } catch (err) {
        setError(
          err instanceof Error
            ? err
            : new Error("Failed to fetch treatment trip data")
        );
      } finally {
        setIsLoading(false);
      }
    }

    fetchTreatmentTrip();
  }, [id]);

  return { tripSymptoms, isLoading, error };
}
