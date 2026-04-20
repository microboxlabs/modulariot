"use client";

import { useEffect, useRef, useState } from "react";
import { TextInput } from "flowbite-react";
import { twMerge } from "tailwind-merge";
import fetcher from "@/features/common/providers/fetcher";
import type { AuthoritySuggestion } from "@/features/common/providers/alfresco-api/alfresco-api.types";

interface AuthorityAutocompleteProps {
  kind: "user" | "group";
  placeholder: string;
  searchingLabel: string;
  noResultsLabel: string;
  disabled?: boolean;
  onSelect: (suggestion: AuthoritySuggestion) => void;
}

const DEBOUNCE_MS = 250;

export function AuthorityAutocomplete({
  kind,
  placeholder,
  searchingLabel,
  noResultsLabel,
  disabled,
  onSelect,
}: Readonly<AuthorityAutocompleteProps>) {
  const [term, setTerm] = useState("");
  const [suggestions, setSuggestions] = useState<AuthoritySuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const trimmed = term.trim();
    if (trimmed.length < 2) {
      setSuggestions([]);
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    abortRef.current?.abort();
    abortRef.current = controller;

    setLoading(true);
    const handle = window.setTimeout(() => {
      const endpoint =
        kind === "user"
          ? "/app/api/alfresco/people/search"
          : "/app/api/alfresco/groups/search";
      const url = `${endpoint}?term=${encodeURIComponent(trimmed)}`;

      fetcher<{ data: AuthoritySuggestion[] }>(url, { signal: controller.signal })
        .then((res) => {
          if (!controller.signal.aborted) {
            setSuggestions(res.data ?? []);
          }
        })
        .catch((err) => {
          if (controller.signal.aborted) return;
          if (err?.name === "AbortError") return;
          setSuggestions([]);
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    }, DEBOUNCE_MS);

    return () => {
      window.clearTimeout(handle);
      controller.abort();
    };
  }, [term, kind]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = (suggestion: AuthoritySuggestion) => {
    onSelect(suggestion);
    setTerm("");
    setSuggestions([]);
    setOpen(false);
  };

  const showPanel = open && term.trim().length >= 2;

  return (
    <div ref={containerRef} className="relative">
      <TextInput
        sizing="sm"
        placeholder={placeholder}
        value={term}
        disabled={disabled}
        onChange={(e) => {
          setTerm(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
      />
      {showPanel && (
        <div
          className={twMerge(
            "absolute z-20 mt-1 w-full rounded-lg border border-gray-200 bg-white shadow-lg",
            "dark:border-gray-600 dark:bg-gray-800 max-h-56 overflow-y-auto"
          )}
        >
          {loading ? (
            <p className="px-3 py-2 text-xs text-gray-500 dark:text-gray-400">
              {searchingLabel}
            </p>
          ) : suggestions.length === 0 ? (
            <p className="px-3 py-2 text-xs text-gray-500 dark:text-gray-400">
              {noResultsLabel}
            </p>
          ) : (
            <ul className="py-1">
              {suggestions.map((s) => (
                <li key={`${s.kind}:${s.id}`}>
                  <button
                    type="button"
                    onClick={() => handleSelect(s)}
                    className={twMerge(
                      "w-full text-left px-3 py-1.5 text-sm text-gray-700",
                      "hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700"
                    )}
                  >
                    <span className="font-medium">{s.displayName}</span>
                    <span className="ml-2 text-xs text-gray-400">{s.id}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
