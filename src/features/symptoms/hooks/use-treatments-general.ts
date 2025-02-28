"use client";

import { useState, useEffect } from "react";
import { 
  TreatmentsGeneralResponseItem, 
  TreatmentsTimelineResponse 
} from "@/app/api/treatments/general/route.type";

export function useTreatmentsGeneral(id?: string) {
  const [treatmentData, setTreatmentData] = useState<TreatmentsGeneralResponseItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    async function fetchTreatmentData() {
      try {
        setLoading(true);
        const response = await fetch(`/app/api/treatments/general?id=${id}`);
        
        if (!response.ok) throw new Error('Failed to fetch treatment data');
        
        const data = await response.json();
        setTreatmentData(data);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to fetch treatment data'));
      } finally {
        setLoading(false);
      }
    }

    fetchTreatmentData();
  }, [id]);

  return { treatmentData, loading, error };
} 