"use client";

import {
  useEffect,
  useRef,
  useState,
  type FocusEvent,
  type KeyboardEvent,
} from "react";
import { Badge, Spinner, TextInput } from "flowbite-react";
import { HiCheck } from "react-icons/hi";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import { useM2MClients } from "../use-m2m-clients";

interface M2MClientComboboxProps {
  readonly id: string;
  /** The stored client id. Free text is allowed — see the note below. */
  readonly value: string;
  readonly onChange: (clientId: string) => void;
  readonly orgSlug: string | null;
  readonly invalid?: boolean;
  readonly dict: I18nRecord;
}

/**
 * Client-id field for the Auth0 credential form: a typeahead over the M2M
 * applications the org may use, that still accepts a value typed by hand.
 *
 * Free text is deliberate. The directory is one service's view of the catalog,
 * and an operator configuring a client it hasn't learned about yet — a brand new
 * one, or one from a tenant the entitlement filter reads conservatively — must
 * not be blocked by an autocomplete. The list is an accelerator, not a
 * whitelist; the credential's own Test action is what proves the value works.
 */
export function M2MClientCombobox({
  id,
  value,
  onChange,
  orgSlug,
  invalid = false,
  dict,
}: M2MClientComboboxProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const listboxId = `${id}-listbox`;

  const { clients, isLoading, error } = useM2MClients(orgSlug, query, open);

  // Close on outside click. Without this the list survives a click into another
  // field and overlaps whatever the operator moved on to.
  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        closeList();
      }
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  function openList() {
    setQuery(value);
    setActiveIndex(-1);
    setOpen(true);
  }

  function closeList() {
    setActiveIndex(-1);
    setOpen(false);
  }

  function select(clientId: string) {
    onChange(clientId);
    setQuery("");
    closeList();
  }

  function moveActive(direction: 1 | -1) {
    setActiveIndex((current) => {
      if (clients.length === 0) return -1;
      if (current === -1) return direction === 1 ? 0 : clients.length - 1;
      return (current + direction + clients.length) % clients.length;
    });
  }

  function onInputKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      closeList();
      return;
    }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!open) {
        setQuery(value);
        setOpen(true);
      }
      moveActive(event.key === "ArrowDown" ? 1 : -1);
      return;
    }
    if (event.key === "Enter" && open) {
      const client = clients[activeIndex];
      if (!client) return;
      event.preventDefault();
      select(client.clientId);
    }
  }

  function onContainerBlur(event: FocusEvent<HTMLDivElement>) {
    const nextFocus = event.relatedTarget;
    if (nextFocus instanceof Node && event.currentTarget.contains(nextFocus)) {
      return;
    }
    closeList();
  }

  const selected = clients.find((client) => client.clientId === value);

  return (
    <div ref={containerRef} className="relative" onBlur={onContainerBlur}>
      <TextInput
        id={id}
        autoComplete="off"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={open}
        aria-controls={listboxId}
        aria-activedescendant={
          activeIndex >= 0 ? `${id}-option-${activeIndex}` : undefined
        }
        placeholder={tr("modal.auth0ClientIdPlaceholder", dict)}
        value={open ? query : value}
        color={invalid ? "failure" : undefined}
        onFocus={openList}
        onChange={(event) => {
          const next = event.target.value;
          setQuery(next);
          setActiveIndex(-1);
          setOpen(true);
          // Typing replaces the stored value directly, so a hand-entered id is
          // saved even when the operator never opens or picks from the list.
          onChange(next);
        }}
        onKeyDown={onInputKeyDown}
      />

      {/* Resolved name for the stored id, so the field reads as more than an
          opaque string once a selection is made. */}
      {!open && selected && (
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          {selected.name}
        </p>
      )}

      {open && (
        <div className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-800">
          {isLoading && clients.length === 0 && (
            <div className="flex items-center gap-2 px-3 py-3">
              <Spinner size="sm" />
              <span className="text-sm text-gray-500 dark:text-gray-400">
                {tr("modal.auth0DirectoryLoading", dict)}
              </span>
            </div>
          )}

          {error && (
            <div className="px-3 py-3 text-sm text-red-600 dark:text-red-400">
              {tr("modal.auth0DirectoryError", dict)}
            </div>
          )}

          {!error && !isLoading && clients.length === 0 && (
            <div className="px-3 py-3 text-sm text-gray-500 dark:text-gray-400">
              {tr("modal.auth0DirectoryEmpty", dict)}
            </div>
          )}

          <ul id={listboxId} role="listbox">
            {clients.map((client, index) => (
              <li key={client.clientId} role="none">
                <button
                  id={`${id}-option-${index}`}
                  type="button"
                  role="option"
                  aria-selected={client.clientId === value}
                  onClick={() => select(client.clientId)}
                  onFocus={() => setActiveIndex(index)}
                  onMouseEnter={() => setActiveIndex(index)}
                  className={`flex w-full items-start gap-2 px-3 py-2 text-left hover:bg-blue-50 dark:hover:bg-gray-700 ${
                    index === activeIndex ? "bg-blue-50 dark:bg-gray-700" : ""
                  }`}
                >
                  <span className="flex h-4 w-4 shrink-0 items-center justify-center pt-0.5">
                    {client.clientId === value && (
                      <HiCheck className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="truncate text-sm font-medium text-gray-900 dark:text-gray-100">
                        {client.name}
                      </span>
                      {/* The org's own clients are what an operator is nearly
                          always after, so they say so rather than sitting
                          indistinguishable among directory suggestions. */}
                      {client.source === "ORGANIZATION" && (
                        <Badge color="info" size="xs">
                          {tr("modal.auth0ClientOwned", dict)}
                        </Badge>
                      )}
                      {!client.active && (
                        <Badge color="gray" size="xs">
                          {tr("modal.auth0ClientInactive", dict)}
                        </Badge>
                      )}
                    </span>
                    <span className="mt-0.5 block truncate font-mono text-xs text-gray-500 dark:text-gray-400">
                      {client.clientId}
                    </span>
                    {client.description && (
                      <span className="mt-0.5 block truncate text-xs text-gray-500 dark:text-gray-400">
                        {client.description}
                      </span>
                    )}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
