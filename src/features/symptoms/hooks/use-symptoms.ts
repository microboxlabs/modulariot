import { useState, useEffect } from "react";
import { SymptomsService } from "@/features/symptoms/services/symptoms.service";
import { SymptomDashboard } from "@/features/symptoms/types/symptoms";

export function useSymptoms() {
  const [symptoms, setSymptoms] = useState<SymptomDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    async function fetchSymptoms() {
      try {
        const data = await SymptomsService.getSymptomsDashboard();
        setSymptoms(data);
      } catch (err) {
        setError(
          err instanceof Error ? err : new Error("Failed to fetch symptoms"),
        );
      } finally {
        setLoading(false);
      }
    }

    fetchSymptoms();
  }, []);

  return { symptoms, loading, error };
}
