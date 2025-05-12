import useSWR from "swr";
import fetcher from "@/features/common/providers/fetcher";
import { FetcherError } from "@/features/common/providers/fetcher.types";

export type TaskLoads = {
  carga_json:
    | {
        grupo_codigo: string;
        bultos: number;
        expedicion_codigo: number;
        peso: number;
        volumen: number;
        expedicion_numero: string;
        alto: number;
        ancho: number;
        largo: number;
      }[]
    | null;
  mensaje: string | null;
};

export function useLoadTable(tripId: string) {
  const { data, error, isLoading } = useSWR<TaskLoads | null, FetcherError>(
    `/app/api/task/loads?tripId=${tripId}`,
    fetcher,
  );

  return {
    data,
    error,
    isLoading,
  };
}
