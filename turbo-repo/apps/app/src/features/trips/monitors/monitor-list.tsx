"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Alert,
  Badge,
  Button,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  Spinner,
  TextInput,
} from "flowbite-react";
import {
  HiOutlineClipboardCheck,
  HiOutlineInboxIn,
  HiOutlineLocationMarker,
  HiOutlineMap,
  HiPlus,
  HiSearch,
} from "react-icons/hi";
import CatalogTable from "@/features/common/components/catalog-table";
import LayoutToggle, {
  type CatalogLayout,
} from "@/features/common/components/layout-toggle";
import SettingsPageShell from "@/features/common/components/settings-page-shell";
import SectionMenu, {
  type SectionMenuEntry,
} from "@/features/common/components/section-menu";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import LocationsPanel from "../locations/locations-panel";
import PendingPanel from "../milestones/pending-panel";
import FeedsPanel from "../feeds/feeds-panel";
import { FEED_ADMIN } from "../feeds/feeds-api";
import { scopeSummary } from "./scope-section";
import {
  saveDraft,
  useCanEditMonitors,
  useMonitors,
  useScopeValues,
  useTripsPermission,
  type MonitorSummary,
  type ScopeValues,
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
        scope: null,
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
  values,
  d,
  onOpen,
}: Readonly<{
  m: MonitorSummary;
  lang: string;
  values: ScopeValues | undefined;
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
      <p className="mt-2 truncate px-4 text-xs text-gray-700 dark:text-gray-200">
        <span className="text-gray-500 dark:text-gray-400">
          {tr("scope.title", d)}:{" "}
        </span>
        {scopeSummary(m.scope, values, d)}
      </p>
      <p className="mt-1 line-clamp-2 h-8 px-4 text-xs text-gray-600 dark:text-gray-300">
        {m.description ?? tr("noDescription", d)}
      </p>
      <div className="min-h-3 flex-1" />
      <div className="truncate border-t border-gray-100 px-4 py-2.5 text-xs text-gray-500 dark:border-gray-700/60 dark:text-gray-400">
        {updatedLine(m, lang)}
      </div>
    </div>
  );
}

type TripsSection = "monitors" | "pending" | "locations" | "feeds";
const SECTIONS: readonly TripsSection[] = [
  "monitors",
  "pending",
  "locations",
  "feeds",
];

/** The section in `?section=`; Monitores when absent or unknown. */
export function tripsSectionOf(params: URLSearchParams): TripsSection {
  const value = params.get("section");
  return SECTIONS.find((s) => s === value) ?? "monitors";
}

const SECTION_ICONS: Record<
  TripsSection,
  SectionMenuEntry<TripsSection>["icon"]
> = {
  monitors: HiOutlineMap,
  pending: HiOutlineClipboardCheck,
  locations: HiOutlineLocationMarker,
  feeds: HiOutlineInboxIn,
};

function MonitorsSection({
  monitors,
  shown,
  loaded,
  error,
  isLoading,
  layout,
  scopeValues,
  lang,
  d,
  onOpen,
}: Readonly<{
  monitors: MonitorSummary[];
  shown: MonitorSummary[];
  loaded: boolean;
  error: Error | undefined;
  isLoading: boolean;
  layout: CatalogLayout;
  scopeValues: ScopeValues | undefined;
  lang: string;
  d: I18nRecord;
  onOpen: (key: string) => void;
}>) {
  return (
    <>
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
      {loaded && shown.length === 0 && (
        <div className="rounded-lg border border-gray-200 bg-white p-8 text-center text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400">
          {monitors.length === 0 ? tr("empty", d) : tr("noMatches", d)}
        </div>
      )}
      {shown.length > 0 && layout === "cards" && (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2 2xl:grid-cols-3">
          {shown.map((m) => (
            <MonitorCard
              key={m.key}
              m={m}
              lang={lang}
              values={scopeValues}
              d={d}
              onOpen={() => onOpen(m.key)}
            />
          ))}
        </div>
      )}
      {shown.length > 0 && layout === "list" && (
        <CatalogTable
          columns={[
            tr("monitor", d),
            tr("scope.title", d),
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
                {scopeSummary(m.scope, scopeValues, d)}
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
    </>
  );
}

/**
 * Settings › Viajes, laid out like Comunicaciones: a menu of sections beside the chosen one.
 * Monitores (each with the trips it takes), Por confirmar, Ubicaciones and Feeds.
 */
export default function MonitorList({
  dict,
  lang,
}: Readonly<{ dict: I18nRecord; lang: string }>) {
  const d = dict?.tripMonitors as I18nRecord;
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const section = tripsSectionOf(params);
  const { data, error, isLoading } = useMonitors();
  const canEdit = useCanEditMonitors();
  const canEditFeeds = useTripsPermission(FEED_ADMIN);
  const { data: scopeValues } = useScopeValues();
  const [creating, setCreating] = useState(false);
  const [creatingFeed, setCreatingFeed] = useState(false);
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
  const onSection = (next: TripsSection) => {
    const query = new URLSearchParams(params.toString());
    if (next === "monitors") query.delete("section");
    else query.set("section", next);
    const qs = query.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  const sections: SectionMenuEntry<TripsSection>[] = SECTIONS.map((id) => ({
    id,
    label: tr(`sections.${id}.label`, d),
    description: tr(`sections.${id}.description`, d),
    icon: SECTION_ICONS[id],
  }));

  return (
    <SettingsPageShell
      breadcrumbDict={dict?.breadcrumb as I18nRecord}
      lang={lang}
      path={["user", "settings", "trips"]}
      icon={HiOutlineMap}
      title={tr("pageTitle", d)}
      description={tr("pageDescription", d)}
      filters={
        section === "monitors" && (
          <TextInput
            className="w-full sm:w-72"
            sizing="sm"
            icon={HiSearch}
            value={q}
            aria-label={tr("search", d)}
            placeholder={tr("search", d)}
            onChange={(e) => setQ(e.target.value)}
          />
        )
      }
      actions={
        <div className="flex shrink-0 items-center gap-2">
          {section === "monitors" && (
            <LayoutToggle
              layout={layout}
              labels={{ cards: tr("viewCards", d), list: tr("viewList", d) }}
              onLayout={setLayout}
            />
          )}
          {section === "monitors" && canEdit && (
            <Button color="blue" size="sm" onClick={() => setCreating(true)}>
              <HiPlus className="mr-1 h-4 w-4" />
              {tr("newMonitor", d)}
            </Button>
          )}
          {section === "feeds" && canEditFeeds && (
            <Button
              color="blue"
              size="sm"
              onClick={() => setCreatingFeed(true)}
            >
              <HiPlus className="mr-1 h-4 w-4" />
              {tr("newFeed", dict?.tripFeeds as I18nRecord)}
            </Button>
          )}
        </div>
      }
    >
      {/* Below md the menu and the detail stack and scroll together; from md only the detail scrolls. */}
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 max-md:overflow-y-auto md:grid-cols-[320px_1fr]">
        <SectionMenu
          title={tr("menuTitle", d)}
          sections={sections}
          selected={section}
          onSelect={onSection}
        />
        <div className="-m-1 flex min-h-0 flex-col gap-4 p-1 md:overflow-y-auto">
          {section === "monitors" && (
            <MonitorsSection
              monitors={monitors}
              shown={shown}
              loaded={!!data}
              error={error}
              isLoading={isLoading}
              layout={layout}
              scopeValues={scopeValues}
              lang={lang}
              d={d}
              onOpen={open}
            />
          )}
          {section === "pending" && (
            <PendingPanel d={dict?.tripMilestones as I18nRecord} lang={lang} />
          )}
          {section === "locations" && (
            <LocationsPanel d={dict?.tripLocations as I18nRecord} />
          )}
          {section === "feeds" && (
            <FeedsPanel
              creating={creatingFeed}
              onCreatingDone={() => setCreatingFeed(false)}
              d={dict?.tripFeeds as I18nRecord}
              md={d}
            />
          )}
        </div>
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
