import { useState, useEffect } from "react";
import { SymptomsService } from "../services/symptoms.service";
import { SymptomDashboard } from "../types/symptoms";

export function useSymptoms(pollingInterval = 30000) {
  const [symptoms, setSymptoms] = useState<SymptomDashboard | null>(null);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let mounted = true;
    let intervalId: ReturnType<typeof setInterval>;

    async function fetchSymptoms() {
      try {
        const data = await SymptomsService.getSymptomsDashboard();
        if (mounted) {
          setSymptoms(data);
          // Calculate total from all symptom counts
          const total = data ? data.codeBlack + data.critic : 0;
          setCount(total);
          setError(null);
        }
      } catch (err) {
        if (mounted) {
          setError(
            err instanceof Error ? err : new Error("Failed to fetch symptoms"),
          );
          console.error("Symptoms fetch error:", err);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    fetchSymptoms();
    intervalId = setInterval(fetchSymptoms, pollingInterval);

    return () => {
      mounted = false;
      clearInterval(intervalId);
    };
  }, [pollingInterval]);

  return { symptoms, count, loading, error };
}
