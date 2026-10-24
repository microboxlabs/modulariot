"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Badge,
  Button,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  Select,
  TextInput,
} from "flowbite-react";
import { HiOutlineMap, HiPlus, HiX } from "react-icons/hi";
import { Breadcrumb } from "@/features/common/components/Breadcrumb/Breadcrumb";
import { IconTile } from "@/features/common/components/icon-tile/icon-tile";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import LocationsPanel from "../locations/locations-panel";
import ExpressionField from "./expression-field";
import {
  saveDraft,
  saveSelector,
  useCanEditMonitors,
  useMonitors,
  useSelector,
  type MonitorSummary,
} from "./monitors-api";

const KEY = /^[a-z0-9][a-z0-9-]*$/;

/** Lowercase letters, digits and dashes from a name: "Servicio directo" → "servicio-directo". */
export function keyFromName(name: string) {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

function CreateMonitorModal({
  show,
  onClose,
  taken,
  d,
  onCreated,
}: Readonly<{
  show: boolean;
  onClose: () => void;
  taken: string[];
  d: I18nRecord;
  onCreated: (key: string) => void;
}>) {
  const [name, setName] = useState("");
  const [key, setKey] = useState("");
  const [keyEdited, setKeyEdited] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (show) {
      setName("");
      setKey("");
      setKeyEdited(false);
      setError(null);
    }
  }, [show]);

  const invalid = !name.trim() || !KEY.test(key) || taken.includes(key);

  const create = async () => {
    setBusy(true);
    setError(null);
    try {
      await saveDraft(key, {
        name: name.trim(),
        description: null,
        plan: [],
        params: {},
        rules: [],
      });
      onCreated(key);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal show={show} onClose={onClose} size="md">
      <ModalHeader>{tr("newMonitor", d)}</ModalHeader>
      <ModalBody>
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {tr("name", d)}
            </span>
            <TextInput
              value={name}
              aria-label={tr("name", d)}
              placeholder={tr("namePlaceholder", d)}
              onChange={(e) => {
                setName(e.target.value);
                if (!keyEdited) setKey(keyFromName(e.target.value));
              }}
            />
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {tr("key", d)}
            </span>
            <TextInput
              value={key}
              className="font-mono"
              aria-label={tr("key", d)}
              onChange={(e) => {
                setKey(e.target.value);
                setKeyEdited(true);
              }}
            />
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {taken.includes(key) ? tr("keyTaken", d) : tr("keyHint", d)}
            </p>
          </div>
          {error && (
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          )}
        </div>
      </ModalBody>
      <ModalFooter>
        <Button color="blue" disabled={invalid || busy} onClick={create}>
          {tr("create", d)}
        </Button>
        <Button color="alternative" onClick={onClose}>
          {tr("cancel", d)}
        </Button>
      </ModalFooter>
    </Modal>
  );
}

function SelectorPanel({
  monitors,
  canEdit,
  d,
}: Readonly<{ monitors: MonitorSummary[]; canEdit: boolean; d: I18nRecord }>) {
  const { data } = useSelector();
  const published = monitors.filter((m) => m.publishedVersion !== null);
  const [entries, setEntries] = useState<
    { condition: string; monitorKey: string }[] | null
  >(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (data && entries === null) {
      setEntries(
        data.entries.map((e) => ({
          condition: e.condition,
          monitorKey: e.monitorKey,
        }))
      );
    }
  }, [data, entries]);

  if (!entries) return null;
  const set = (i: number, patch: Partial<(typeof entries)[number]>) =>
    setEntries(entries.map((e, j) => (j === i ? { ...e, ...patch } : e)));

  const save = async () => {
    setBusy(true);
    setMessage(null);
    try {
      await saveSelector(entries);
      setMessage(tr("selectorSaved", d));
    } catch (e) {
      setMessage(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="flex flex-col gap-3 rounded-lg border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
      <div>
        <h2 className="text-base font-semibold text-gray-900 dark:text-white">
          {tr("selector", d)}
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {tr("selectorHint", d)}
        </p>
      </div>
      {entries.length === 0 && (
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {tr("selectorEmpty", d)}
        </p>
      )}
      {entries.map((e, i) => (
        // Entries are ordered rows without an identity of their own.
        <div key={i} className="flex items-end gap-2">
          <span className="w-6 pb-2 text-right text-xs text-gray-400">
            {i + 1}
          </span>
          <div className="flex-1">
            <ExpressionField
              label={tr("selectorCondition", d)}
              value={e.condition}
              onChange={(condition) => set(i, { condition })}
              on="selector"
              expect="condition"
              params={{}}
              readOnly={!canEdit}
              placeholder="trip.orderType == 'reparto'"
            />
          </div>
          <Select
            sizing="sm"
            value={e.monitorKey}
            disabled={!canEdit}
            aria-label={tr("monitor", d)}
            onChange={(ev) => set(i, { monitorKey: ev.target.value })}
          >
            {published.map((m) => (
              <option key={m.key} value={m.key}>
                {m.name}
              </option>
            ))}
          </Select>
          {canEdit && (
            <button
              type="button"
              className="mb-1 rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-700"
              aria-label={tr("removeEntry", d)}
              onClick={() => setEntries(entries.filter((_, j) => j !== i))}
            >
              <HiX className="h-4 w-4" />
            </button>
          )}
        </div>
      ))}
      {message && (
        <p className="text-sm text-gray-700 dark:text-gray-200">{message}</p>
      )}
      {canEdit && (
        <div className="flex items-center gap-2">
          <Button
            color="light"
            size="sm"
            disabled={published.length === 0}
            onClick={() =>
              setEntries([
                ...entries,
                { condition: "", monitorKey: published[0].key },
              ])
            }
          >
            <HiPlus className="mr-1 h-4 w-4" />
            {tr("addEntry", d)}
          </Button>
          <Button color="blue" size="sm" disabled={busy} onClick={save}>
            {tr("saveSelector", d)}
          </Button>
        </div>
      )}
    </section>
  );
}

/**
 * Settings › Viajes: the organization's trip monitors, one per class of trip,
 * and the selector that picks one for a trip created without it.
 */
export default function MonitorList({
  dict,
  lang,
}: Readonly<{ dict: I18nRecord; lang: string }>) {
  const d = dict?.tripMonitors as I18nRecord;
  const router = useRouter();
  const { data, error, isLoading } = useMonitors();
  const canEdit = useCanEditMonitors();
  const [creating, setCreating] = useState(false);
  const monitors = data ?? [];
  const open = (key: string) =>
    router.push(
      `/${lang}/users/settings/trips/monitors/${encodeURIComponent(key)}`
    );

  return (
    <div className="flex h-full w-full flex-col overflow-hidden">
      <div className="flex w-full items-center justify-between border-b border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-900 dark:text-white">
        <Breadcrumb
          dict={dict?.breadcrumb as I18nRecord}
          lang={lang}
          path={["user", "settings", "trips"]}
          disableLinks
        />
      </div>

      <div className="mx-auto flex w-full max-w-screen-xl flex-1 min-h-0 flex-col gap-4 overflow-y-auto px-4 pt-2 pb-10 dark:bg-gray-900">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <IconTile icon={HiOutlineMap} />
            <div>
              <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
                {tr("title", d)}
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {tr("description", d)}
              </p>
            </div>
          </div>
          {canEdit && (
            <Button color="blue" size="sm" onClick={() => setCreating(true)}>
              <HiPlus className="mr-1.5 h-4 w-4" />
              {tr("newMonitor", d)}
            </Button>
          )}
        </div>

        {isLoading && (
          <p className="text-sm text-gray-500">{tr("loading", d)}</p>
        )}
        {error && (
          <p className="text-sm text-red-600 dark:text-red-400">
            {error.message}
          </p>
        )}
        {data && monitors.length === 0 && (
          <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-gray-300 px-4 py-16 text-center dark:border-gray-700">
            <IconTile icon={HiOutlineMap} />
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {tr("empty", d)}
            </p>
          </div>
        )}

        {monitors.length > 0 && (
          <div className="overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700">
            <table className="w-full text-left text-sm text-gray-600 dark:text-gray-300">
              <thead className="bg-gray-50 text-xs uppercase text-gray-500 dark:bg-gray-800 dark:text-gray-400">
                <tr>
                  <th className="px-4 py-3">{tr("monitor", d)}</th>
                  <th className="px-4 py-3">{tr("version", d)}</th>
                  <th className="px-4 py-3">{tr("rules", d)}</th>
                  <th className="px-4 py-3">{tr("updated", d)}</th>
                </tr>
              </thead>
              <tbody>
                {monitors.map((m) => (
                  <tr
                    key={m.key}
                    className="cursor-pointer border-t border-gray-200 bg-white hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:hover:bg-gray-800"
                    onClick={() => open(m.key)}
                  >
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900 dark:text-white">
                        {m.name}
                      </div>
                      <div className="font-mono text-xs text-gray-400">
                        {m.key}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        {m.publishedVersion !== null && (
                          <Badge color="success">v{m.publishedVersion}</Badge>
                        )}
                        {m.draftVersion !== null && (
                          <Badge color="warning">
                            {tr("draftVersion", d, {
                              version: String(m.draftVersion),
                            })}
                          </Badge>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">{m.rules}</td>
                    <td className="px-4 py-3 text-xs text-gray-400">
                      {m.updatedBy}
                      {m.updatedAt
                        ? ` · ${new Date(m.updatedAt).toLocaleString(lang)}`
                        : ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {data && <SelectorPanel monitors={monitors} canEdit={canEdit} d={d} />}

        <LocationsPanel d={dict?.tripLocations as I18nRecord} />
      </div>

      <CreateMonitorModal
        show={creating}
        onClose={() => setCreating(false)}
        taken={monitors.map((m) => m.key)}
        d={d}
        onCreated={(key) => {
          setCreating(false);
          open(key);
        }}
      />
    </div>
  );
}
