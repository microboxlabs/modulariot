"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Alert,
  Badge,
  Button,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  Select,
  Spinner,
  TextInput,
} from "flowbite-react";
import { HiOutlineMap, HiPlus, HiSearch, HiX } from "react-icons/hi";
import CatalogTable from "@/features/common/components/catalog-table";
import LayoutToggle, {
  type CatalogLayout,
} from "@/features/common/components/layout-toggle";
import SettingsPageShell from "@/features/common/components/settings-page-shell";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import LocationsPanel from "../locations/locations-panel";
import PendingPanel from "../milestones/pending-panel";
import ExpressionField from "./expression-field";
import { useRowKeys } from "./use-row-keys";
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
    .replace(/^-/, "")
    .replace(/-$/, "")
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

  const rowKeys = useRowKeys(entries?.length ?? 0);

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
        // Keep editor identity when earlier rows are removed.
        <div key={rowKeys.keys[i]} className="flex items-end gap-2">
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
              readOnly={!canEdit || busy}
              placeholder="trip.orderType == 'reparto'"
            />
          </div>
          <Select
            sizing="sm"
            value={e.monitorKey}
            disabled={!canEdit || busy}
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
              disabled={busy}
              aria-label={tr("removeEntry", d)}
              onClick={() => {
                rowKeys.remove(i);
                setEntries(entries.filter((_, j) => j !== i));
              }}
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
            disabled={busy || published.length === 0}
            onClick={() => {
              rowKeys.append();
              setEntries([
                ...entries,
                { condition: "", monitorKey: published[0].key },
              ]);
            }}
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

/** One-line identity of a monitor's published and draft versions. */
function VersionBadges({
  m,
  d,
}: Readonly<{ m: MonitorSummary; d: I18nRecord }>) {
  return (
    <div className="flex flex-wrap gap-1">
      {m.publishedVersion !== null && (
        <Badge color="success">v{m.publishedVersion}</Badge>
      )}
      {m.draftVersion !== null && (
        <Badge color="warning">
          {tr("draftVersion", d, { version: String(m.draftVersion) })}
        </Badge>
      )}
    </div>
  );
}

function updatedLine(m: MonitorSummary, lang: string) {
  return [
    m.updatedAt ? new Date(m.updatedAt).toLocaleDateString(lang) : null,
    m.updatedBy,
  ]
    .filter(Boolean)
    .join(" · ");
}

/** A monitor as a card, like the other settings catalogs: identity, state, then who changed it. */
function MonitorCard({
  m,
  lang,
  d,
  onOpen,
}: Readonly<{
  m: MonitorSummary;
  lang: string;
  d: I18nRecord;
  onOpen: () => void;
}>) {
  return (
    <div className="relative flex flex-col rounded-lg border border-gray-200 bg-white transition has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-blue-500 hover:border-blue-400 hover:shadow-md dark:border-gray-700 dark:bg-gray-800 dark:hover:border-blue-500">
      <div className="flex items-start gap-3 px-4 pt-4">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-700 dark:bg-gray-700 dark:text-blue-400">
          <HiOutlineMap className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <button
            type="button"
            onClick={onOpen}
            className="block w-full cursor-pointer truncate text-left font-semibold text-gray-900 after:absolute after:inset-0 after:rounded-lg focus:outline-none dark:text-white"
          >
            {m.name}
          </button>
          <div className="truncate font-mono text-xs text-gray-500 dark:text-gray-400">
            {m.key}
          </div>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2 px-4">
        <VersionBadges m={m} d={d} />
        <span className="text-xs text-gray-500 dark:text-gray-400">
          {tr("rulesCount", d, { count: String(m.rules) })}
        </span>
      </div>
      <p className="mt-2 line-clamp-2 h-8 px-4 text-xs text-gray-600 dark:text-gray-300">
        {m.description ?? tr("noDescription", d)}
      </p>
      <div className="min-h-3 flex-1" />
      <div className="truncate border-t border-gray-100 px-4 py-2.5 text-xs text-gray-500 dark:border-gray-700/60 dark:text-gray-400">
        {updatedLine(m, lang)}
      </div>
    </div>
  );
}

/**
 * Settings › Viajes: the organization's trip monitors, one per class of trip, as cards or a
 * list like the other settings catalogs; then the selector that picks one for a trip created
 * without it, and the locations with their GPS geofence.
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
  const [q, setQ] = useState("");
  const [layout, setLayout] = useState<CatalogLayout>("cards");
  const monitors = data ?? [];
  const needle = q.trim().toLowerCase();
  const shown = needle
    ? monitors.filter(
        (m) =>
          m.name.toLowerCase().includes(needle) ||
          m.key.toLowerCase().includes(needle)
      )
    : monitors;
  const open = (key: string) =>
    router.push(
      `/${lang}/users/settings/trips/monitors/${encodeURIComponent(key)}`
    );

  return (
    <SettingsPageShell
      breadcrumbDict={dict?.breadcrumb as I18nRecord}
      lang={lang}
      path={["user", "settings", "trips"]}
      icon={HiOutlineMap}
      title={tr("title", d)}
      description={tr("description", d)}
      filters={
        <TextInput
          className="w-full sm:w-72"
          sizing="sm"
          icon={HiSearch}
          value={q}
          aria-label={tr("search", d)}
          placeholder={tr("search", d)}
          onChange={(e) => setQ(e.target.value)}
        />
      }
      actions={
        <div className="flex shrink-0 items-center gap-2">
          <LayoutToggle
            layout={layout}
            labels={{ cards: tr("viewCards", d), list: tr("viewList", d) }}
            onLayout={setLayout}
          />
          {canEdit && (
            <Button color="blue" size="sm" onClick={() => setCreating(true)}>
              <HiPlus className="mr-1 h-4 w-4" />
              {tr("newMonitor", d)}
            </Button>
          )}
        </div>
      }
    >
      <div className="-mx-1 flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-1 pb-1">
        {error && (
          <Alert color="failure">
            <span className="text-sm">{error.message}</span>
          </Alert>
        )}

        {isLoading && (
          <div className="flex justify-center py-10">
            <Spinner aria-label={tr("loading", d)} />
          </div>
        )}
        {data && shown.length === 0 && (
          <div className="rounded-lg border border-gray-200 bg-white p-8 text-center text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400">
            {monitors.length === 0 ? tr("empty", d) : tr("noMatches", d)}
          </div>
        )}

        {shown.length > 0 && layout === "cards" && (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-3">
            {shown.map((m) => (
              <MonitorCard
                key={m.key}
                m={m}
                lang={lang}
                d={d}
                onOpen={() => open(m.key)}
              />
            ))}
          </div>
        )}
        {shown.length > 0 && layout === "list" && (
          <CatalogTable
            columns={[
              tr("monitor", d),
              tr("version", d),
              tr("rules", d),
              tr("updated", d),
            ]}
          >
            {shown.map((m) => (
              <tr
                key={m.key}
                className="cursor-pointer border-t border-gray-200 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-700/50"
              >
                <td className="px-4 py-2.5">
                  <Link
                    href={`/${lang}/users/settings/trips/monitors/${encodeURIComponent(m.key)}`}
                    className="font-medium text-gray-900 hover:underline dark:text-white"
                  >
                    {m.name}
                  </Link>
                  <div className="font-mono text-gray-400">{m.key}</div>
                </td>
                <td className="px-4 py-2.5">
                  <VersionBadges m={m} d={d} />
                </td>
                <td className="px-4 py-2.5">{m.rules}</td>
                <td className="px-4 py-2.5 text-gray-400">
                  {updatedLine(m, lang)}
                </td>
              </tr>
            ))}
          </CatalogTable>
        )}

        {data && <SelectorPanel monitors={monitors} canEdit={canEdit} d={d} />}

        <PendingPanel d={dict?.tripMilestones as I18nRecord} lang={lang} />

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
    </SettingsPageShell>
  );
}
