"use client";

import { useSyncExternalStore } from "react";
import { useSearchParams } from "next/navigation";
import {
  DEFAULT_OPERATOR_FILTER,
  OPERATOR_FILTER_KEY,
  OPERATOR_PARAM,
  parseOperatorFilter,
  type OperatorFilter,
} from "../model/operator-filter";

const SAME_TAB_EVENT = "miot:operator-filter";

/** The stored choice, or the default when there is none or it cannot be read. */
export function readOperatorFilter(): OperatorFilter {
  try {
    return (
      parseOperatorFilter(localStorage.getItem(OPERATOR_FILTER_KEY)) ??
      DEFAULT_OPERATOR_FILTER
    );
  } catch {
    return DEFAULT_OPERATOR_FILTER;
  }
}

/** Keeps the choice for the next visit and tells this tab's readers. */
export function storeOperatorFilter(value: OperatorFilter): void {
  try {
    localStorage.setItem(OPERATOR_FILTER_KEY, value);
  } catch {
    // Storage is blocked or full: the choice still applies through the URL.
  }
  globalThis.dispatchEvent(new Event(SAME_TAB_EVENT));
}

function subscribe(onChange: () => void): () => void {
  globalThis.addEventListener("storage", onChange);
  globalThis.addEventListener(SAME_TAB_EVENT, onChange);
  return () => {
    globalThis.removeEventListener("storage", onChange);
    globalThis.removeEventListener(SAME_TAB_EVENT, onChange);
  };
}

/**
 * The filter in effect: the URL's when it names one, else the stored choice,
 * else "required".
 */
export function useOperatorFilter(): OperatorFilter {
  const searchParams = useSearchParams();
  const stored = useSyncExternalStore(
    subscribe,
    readOperatorFilter,
    () => DEFAULT_OPERATOR_FILTER
  );
  return parseOperatorFilter(searchParams.get(OPERATOR_PARAM)) ?? stored;
}
