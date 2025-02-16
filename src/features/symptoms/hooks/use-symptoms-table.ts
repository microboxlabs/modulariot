import { useState, useEffect } from "react";
import { SymptomsTableService } from "../services/symptoms-table.service";
import { SymptomTableResponse } from "../types/symptoms";

interface UseSymptomTableParams {
  page?: number;
  pageSize?: number;
  search?: string;
}

export function useSymptomsTable({
  page = 1,
  pageSize = 10,
  search = "",
}: UseSymptomTableParams = {}) {
  const [tableData, setTableData] = useState<SymptomTableResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    async function fetchTableData() {
      try {
        setLoading(true);
        const data = await SymptomsTableService.getTable({
          page,
          pageSize,
          search,
        });
        setTableData(data);
      } catch (err) {
        setError(
          err instanceof Error
            ? err
            : new Error("Failed to fetch symptoms table"),
        );
      } finally {
        setLoading(false);
      }
    }

    fetchTableData();
  }, [page, pageSize, search]);

  return {
    tableData,
    loading,
    error,
  };
}
