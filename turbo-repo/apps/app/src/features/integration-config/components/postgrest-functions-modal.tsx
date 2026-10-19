"use client";

import { useMemo, useState } from "react";
import useSWR from "swr";
import {
  Alert,
  Badge,
  Button,
  Checkbox,
  Label,
  Modal,
  ModalBody,
  ModalFooter,
  Spinner,
  TextInput,
} from "flowbite-react";
import { HiPlus, HiSearch, HiTrash } from "react-icons/hi";
import { toast } from "sonner";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import {
  fetchPostgrestFunctions,
  importPostgrestFunctions,
} from "../integration-config-data-service";
import {
  buildPostgrestImport,
  type IntegrationConnection,
  type PostgrestFunction,
} from "../integration-config.types";

interface PostgrestFunctionsModalProps {
  readonly orgSlug: string;
  readonly connection: IntegrationConnection;
  readonly onClose: () => void;
  readonly dict: I18nRecord;
}

interface Pin {
  readonly id: number;
  readonly name: string;
  readonly value: string;
}

/**
 * Pick the PostgREST functions dashboards may call. Each imported function becomes a
 * read-only operation on this connection. A pinned value is fixed in the operation, so a
 * dashboard cannot change it; it applies to every selected function that takes it.
 */
export function PostgrestFunctionsModal({
  orgSlug,
  connection,
  onClose,
  dict,
}: Readonly<PostgrestFunctionsModalProps>) {
  const { data, error, isLoading, mutate } = useSWR(
    ["postgrest-functions", orgSlug, connection.id],
    () => fetchPostgrestFunctions(orgSlug, connection.id),
    { revalidateOnFocus: false, shouldRetryOnError: false }
  );
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [pins, setPins] = useState<readonly Pin[]>([]);
  const [importing, setImporting] = useState(false);

  const functions = useMemo(() => data ?? [], [data]);
  const matches = functions.filter((fn) =>
    fn.name.toLowerCase().includes(query.toLowerCase())
  );
  const parameterNames = useMemo(
    () =>
      [
        ...new Set(
          functions
            .filter((fn) => selected.has(fn.name))
            .flatMap((fn) => fn.parameters.map((parameter) => parameter.name))
        ),
      ].sort((a, b) => a.localeCompare(b)),
    [functions, selected]
  );

  function toggle(name: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  function addPin() {
    setPins((current) => [...current, { id: Date.now(), name: "", value: "" }]);
  }

  function updatePin(id: number, patch: Partial<Omit<Pin, "id">>) {
    setPins((current) =>
      current.map((pin) => (pin.id === id ? { ...pin, ...patch } : pin))
    );
  }

  function removePin(id: number) {
    setPins((current) => current.filter((pin) => pin.id !== id));
  }

  async function handleImport() {
    setImporting(true);
    try {
      const result = await importPostgrestFunctions(
        orgSlug,
        connection.id,
        buildPostgrestImport(functions, selected, pins)
      );
      toast.success(
        tr("postgrest.imported", dict, {
          count: String(result.created.length),
        })
      );
      setSelected(new Set());
      await mutate();
    } catch (cause) {
      toast.error(
        cause instanceof Error && cause.message
          ? cause.message
          : tr("toast.actionFailed", dict)
      );
    } finally {
      setImporting(false);
    }
  }

  return (
    <Modal dismissible show onClose={onClose} size="3xl">
      <div className="flex flex-col items-start p-4 md:p-5">
        <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
          {tr("postgrest.title", dict, { name: connection.name })}
        </h2>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          {tr("postgrest.subtitle", dict)}
        </p>
      </div>
      <ModalBody className="max-h-[65vh] space-y-4 overflow-y-auto">
        {error && (
          <Alert color="failure">
            <span className="text-sm">
              {error instanceof Error && error.message
                ? error.message
                : tr("postgrest.loadFailed", dict)}
            </span>
          </Alert>
        )}
        {isLoading && (
          <div className="flex justify-center py-6">
            <Spinner aria-label={tr("list.loading", dict)} />
          </div>
        )}
        {!isLoading && !error && (
          <>
            <TextInput
              id="postgrest-function-search"
              icon={HiSearch}
              placeholder={tr("postgrest.search", dict)}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            <ul className="flex flex-col divide-y divide-gray-200 rounded-lg border border-gray-200 dark:divide-gray-700 dark:border-gray-700">
              {matches.map((fn) => (
                <FunctionRow
                  key={fn.name}
                  fn={fn}
                  checked={selected.has(fn.name)}
                  onToggle={() => toggle(fn.name)}
                  dict={dict}
                />
              ))}
              {matches.length === 0 && (
                <li className="py-6 text-center text-sm text-gray-500 dark:text-gray-400">
                  {functions.length === 0
                    ? tr("postgrest.empty", dict)
                    : tr("postgrest.noMatches", dict)}
                </li>
              )}
            </ul>
            <PinsEditor
              pins={pins}
              parameterNames={parameterNames}
              onAdd={addPin}
              onChange={updatePin}
              onRemove={removePin}
              dict={dict}
            />
          </>
        )}
      </ModalBody>
      <ModalFooter className="justify-end">
        <Button color="light" onClick={onClose}>
          {tr("common.cancel", dict)}
        </Button>
        <Button
          color="blue"
          disabled={selected.size === 0 || importing}
          onClick={handleImport}
        >
          {importing ? (
            <Spinner size="sm" />
          ) : (
            tr("postgrest.import", dict, { count: String(selected.size) })
          )}
        </Button>
      </ModalFooter>
    </Modal>
  );
}

interface FunctionRowProps {
  readonly fn: PostgrestFunction;
  readonly checked: boolean;
  readonly onToggle: () => void;
  readonly dict: I18nRecord;
}

function FunctionRow({ fn, checked, onToggle, dict }: Readonly<FunctionRowProps>) {
  const imported = fn.operationId !== null;
  const id = `postgrest-fn-${fn.name}`;
  return (
    <li className="flex items-start gap-3 p-3">
      <Checkbox
        id={id}
        checked={imported || checked}
        disabled={imported}
        onChange={onToggle}
        className="mt-1"
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <Label htmlFor={id} className="font-mono text-sm">
            {fn.name}
          </Label>
          {imported && <Badge color="success">{tr("postgrest.importedBadge", dict)}</Badge>}
        </div>
        {fn.description && (
          <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
            {fn.description}
          </p>
        )}
        {fn.parameters.length > 0 && (
          <p className="mt-1 break-all font-mono text-[11px] text-gray-500 dark:text-gray-400">
            {fn.parameters.map((parameter) => parameter.name).join(", ")}
          </p>
        )}
      </div>
    </li>
  );
}

interface PinsEditorProps {
  readonly pins: readonly Pin[];
  readonly parameterNames: readonly string[];
  readonly onAdd: () => void;
  readonly onChange: (id: number, patch: Partial<Omit<Pin, "id">>) => void;
  readonly onRemove: (id: number) => void;
  readonly dict: I18nRecord;
}

function PinsEditor({
  pins,
  parameterNames,
  onAdd,
  onChange,
  onRemove,
  dict,
}: Readonly<PinsEditorProps>) {
  return (
    <div className="space-y-2">
      <div>
        <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">
          {tr("postgrest.pinsTitle", dict)}
        </h3>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          {tr("postgrest.pinsHelp", dict)}
        </p>
      </div>
      <datalist id="postgrest-parameter-names">
        {parameterNames.map((name) => (
          <option key={name} value={name} />
        ))}
      </datalist>
      {pins.map((pin) => (
        <div key={pin.id} className="flex items-center gap-2">
          <TextInput
            sizing="sm"
            className="flex-1 font-mono"
            list="postgrest-parameter-names"
            aria-label={tr("postgrest.pinParameter", dict)}
            placeholder={tr("postgrest.pinParameter", dict)}
            value={pin.name}
            onChange={(event) => onChange(pin.id, { name: event.target.value })}
          />
          <TextInput
            sizing="sm"
            className="flex-1"
            aria-label={tr("postgrest.pinValue", dict)}
            placeholder={tr("postgrest.pinValue", dict)}
            value={pin.value}
            onChange={(event) => onChange(pin.id, { value: event.target.value })}
          />
          <Button
            size="xs"
            color="light"
            aria-label={tr("common.delete", dict)}
            onClick={() => onRemove(pin.id)}
          >
            <HiTrash className="h-4 w-4" />
          </Button>
        </div>
      ))}
      <Button size="xs" color="light" onClick={onAdd}>
        <HiPlus className="mr-1 h-3 w-3" />
        {tr("postgrest.addPin", dict)}
      </Button>
    </div>
  );
}
