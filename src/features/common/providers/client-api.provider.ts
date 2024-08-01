import useSWR from "swr";
import fetcher from "./fetcher";

export function useI8n(lang: string) {
  const { data, error, isLoading } = useSWR(`/api/i18n/${lang}`, fetcher);
  return {
    dict: data,
    error,
    isLoading,
  };
}
