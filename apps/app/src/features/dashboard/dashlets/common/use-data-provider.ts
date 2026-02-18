import { useState, useRef, useCallback } from "react";
import type { DataProviderEntry } from "../types";

export interface UseDataProviderReturn {
  dataProvider: DataProviderEntry[];
  addEntry: () => void;
  removeEntry: (index: number) => void;
  updateEntry: (index: number, field: "key" | "value", value: string) => void;
  getCleanEntries: () => Omit<DataProviderEntry, "_id">[];
}

export function useDataProvider(
  initialEntries: DataProviderEntry[]
): UseDataProviderReturn {
  const idCounter = useRef(0);

  const assignId = useCallback(
    (entry: DataProviderEntry): DataProviderEntry => ({
      ...entry,
      _id: entry._id ?? idCounter.current++,
    }),
    []
  );

  const [dataProvider, setDataProvider] = useState<DataProviderEntry[]>(() =>
    initialEntries.map(assignId)
  );

  const addEntry = useCallback(
    () => setDataProvider((prev) => [...prev, assignId({ key: "", value: "" })]),
    [assignId]
  );

  const removeEntry = useCallback(
    (index: number) =>
      setDataProvider((prev) => prev.filter((_, i) => i !== index)),
    []
  );

  const updateEntry = useCallback(
    (index: number, field: "key" | "value", value: string) =>
      setDataProvider((prev) =>
        prev.map((e, i) => (i === index ? { ...e, [field]: value } : e))
      ),
    []
  );

  const getCleanEntries = useCallback(
    () => dataProvider.map(({ _id, ...rest }) => rest),
    [dataProvider]
  );

  return { dataProvider, addEntry, removeEntry, updateEntry, getCleanEntries };
}
