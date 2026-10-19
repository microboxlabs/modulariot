"use client";

import { useMemo, useState } from "react";
import {
  Badge,
  Button,
  Select,
  Spinner,
  TableCell,
  TableRow,
} from "flowbite-react";
import {
  HiOutlineArrowRight,
  HiOutlineClock,
  HiOutlineCube,
  HiOutlineOfficeBuilding,
  HiOutlinePlus,
  HiOutlineShare,
} from "react-icons/hi";
import CustomTable from "@/features/common/components/custom-table/custom-table";
import { KpiStat } from "@/features/common/components/kpi-stat";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr, trDynamic } from "@/features/i18n/tr.service";
import EmptyAnimation from "@/features/symptoms/components/empty-animation";
import DataShareDetailModal from "./data-share-detail-modal";
import DataShareEditor from "./data-share-editor";
import {
  formatDate,
  ORIGIN_COLORS,
  scopeLabel,
  STATUS_COLORS,
} from "./data-sharing";
import OrgCombobox from "./org-combobox";
import type {
  DataShare,
  DataShareOrigin,
  DataShareStatus,
} from "./platform.types";
import { usePlatformDataShares } from "./use-platform-data-shares";

interface DataSharingSectionProps {
  readonly dict: I18nRecord;
  readonly lang: string;
}

/**
 * Which organization sees which other organization's GPS data. Only platform
 * owners create or revoke a share; organizations never pass on what they
 * receive.
 */
export default function DataSharingSection({
  dict,
  lang,
}: Readonly<DataSharingSectionProps>) {
  const { shares, orgs, figures, isLoading, error, create, revoke } =
    usePlatformDataShares();
  const [org, setOrg] = useState("");
  const [status, setStatus] = useState<DataShareStatus | "">("");
  const [origin, setOrigin] = useState<DataShareOrigin | "">("");
  const [creating, setCreating] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  const orgList = useMemo(
    () => [...orgs.values()].sort((a, b) => a.name.localeCompare(b.name)),
    [orgs]
  );
  const orgName = (slug: string) => orgs.get(slug)?.name ?? slug;
  const clearFilters = () => {
    setOrg("");
    setStatus("");
    setOrigin("");
  };

  const visible = useMemo(() => {
    return shares.filter(
      (s) =>
        (!status || s.status === status) &&
        (!origin || s.origin === origin) &&
        (!org || s.sourceOrg === org || s.targetOrg === org)
    );
  }, [shares, status, origin, org]);

  if (creating) {
    return (
      <DataShareEditor
        dict={dict}
        lang={lang}
        orgs={orgs}
        shares={shares}
        onCancel={() => setCreating(false)}
        onCreate={create}
      />
    );
  }

  const header = [
    tr("table.source", dict),
    "",
    tr("table.target", dict),
    tr("table.scope", dict),
    tr("table.origin", dict),
    tr("table.validity", dict),
    tr("table.status", dict),
    "",
  ];
  const content = visible.map((share) => (
    <ShareRow
      key={share.id}
      share={share}
      dict={dict}
      lang={lang}
      sourceName={orgName(share.sourceOrg)}
      targetName={orgName(share.targetOrg)}
      onOpen={() => setOpenId(share.id)}
    />
  ));
  const openShare = shares.find((s) => s.id === openId) ?? null;

  return (
    <section className="flex flex-col gap-4 rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <HiOutlineShare className="h-5 w-5 text-blue-500" />
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
              {tr("title", dict)}
            </h2>
          </div>
          <p className="mt-1 max-w-3xl text-sm text-gray-500 dark:text-gray-400">
            {tr("description", dict)}
          </p>
        </div>
        <Button color="blue" size="sm" onClick={() => setCreating(true)}>
          <HiOutlinePlus className="mr-2 h-4 w-4" />
          {tr("create", dict)}
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <KpiStat
          icon={{ icon: HiOutlineShare }}
          title={{ text: tr("kpi.active", dict), className: "text-xs" }}
          value={{ text: figures.active, className: "text-2xl" }}
          variant="horizontal"
        />
        <KpiStat
          icon={{ icon: HiOutlineOfficeBuilding }}
          title={{ text: tr("kpi.organizations", dict), className: "text-xs" }}
          value={{ text: figures.organizations, className: "text-2xl" }}
          variant="horizontal"
        />
        <KpiStat
          icon={{ icon: HiOutlineCube }}
          title={{ text: tr("kpi.assets", dict), className: "text-xs" }}
          value={{ text: figures.assets, className: "text-2xl" }}
          variant="horizontal"
        />
        <KpiStat
          icon={{ icon: HiOutlineClock }}
          title={{ text: tr("kpi.endingSoon", dict), className: "text-xs" }}
          value={{ text: figures.endingSoon, className: "text-2xl" }}
          variant="horizontal"
        />
      </div>

      <div className="grid grid-cols-1 gap-2 md:grid-cols-[minmax(16rem,1fr)_auto_auto]">
        <OrgCombobox
          id="sharing-org-filter"
          orgs={orgList}
          value={org}
          onChange={setOrg}
          placeholder={tr("filters.org", dict)}
          clearable
          dict={dict}
          lang={lang}
        />
        <Select
          aria-label={tr("table.status", dict)}
          value={status}
          onChange={(e) => setStatus(e.target.value as DataShareStatus | "")}
        >
          <option value="">{tr("filters.allStatuses", dict)}</option>
          {(Object.keys(STATUS_COLORS) as DataShareStatus[]).map((s) => (
            <option key={s} value={s}>
              {trDynamic(`status.${s}`, dict)}
            </option>
          ))}
        </Select>
        <Select
          aria-label={tr("table.origin", dict)}
          value={origin}
          onChange={(e) => setOrigin(e.target.value as DataShareOrigin | "")}
        >
          <option value="">{tr("filters.allOrigins", dict)}</option>
          {(Object.keys(ORIGIN_COLORS) as DataShareOrigin[]).map((o) => (
            <option key={o} value={o}>
              {trDynamic(`origin.${o}`, dict)}
            </option>
          ))}
        </Select>
      </div>

      {error && (
        <p className="text-sm text-red-600 dark:text-red-400">
          {error.status === 503
            ? tr("unavailable", dict)
            : tr("loadError", dict)}
        </p>
      )}

      {isLoading && <Spinner size="md" />}
      {!isLoading && visible.length === 0 && (
        <SharingEmpty
          filtered={shares.length > 0}
          dict={dict}
          onCreate={() => setCreating(true)}
          onClear={clearFilters}
        />
      )}
      {!isLoading && visible.length > 0 && (
        <div className="flex flex-col gap-2">
          <div className="max-h-[32rem] overflow-y-auto rounded-lg border-2 border-gray-300 shadow-md dark:border-gray-600">
            <CustomTable hoverable header={header} content={content} />
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {tr("count", dict, {
              shown: String(visible.length),
              total: String(shares.length),
            })}
          </p>
        </div>
      )}

      <DataShareDetailModal
        dict={dict}
        lang={lang}
        share={openShare}
        orgs={orgs}
        onClose={() => setOpenId(null)}
        onRevoke={revoke}
      />
    </section>
  );
}

interface ShareRowProps {
  readonly share: DataShare;
  readonly dict: I18nRecord;
  readonly lang: string;
  readonly sourceName: string;
  readonly targetName: string;
  readonly onOpen: () => void;
}

function ShareRow({
  share,
  dict,
  lang,
  sourceName,
  targetName,
  onOpen,
}: Readonly<ShareRowProps>) {
  const status = share.status;
  const from = formatDate(share.validFrom, lang);
  const to = formatDate(share.validTo, lang) ?? tr("noEnd", dict);

  return (
    <TableRow className="bg-white dark:bg-gray-800">
      <TableCell className="font-medium text-gray-900 dark:text-white">
        {sourceName}
      </TableCell>
      <TableCell className="w-6 px-0">
        <HiOutlineArrowRight className="h-4 w-4 text-gray-400" />
      </TableCell>
      <TableCell className="font-medium text-gray-900 dark:text-white">
        {targetName}
      </TableCell>
      <TableCell>{scopeLabel(share, dict, lang)}</TableCell>
      <TableCell>
        <Badge color={ORIGIN_COLORS[share.origin]} className="w-fit">
          {trDynamic(`origin.${share.origin}`, dict)}
        </Badge>
      </TableCell>
      <TableCell className="whitespace-nowrap">
        {from} – {to}
      </TableCell>
      <TableCell>
        <Badge color={STATUS_COLORS[status]} className="w-fit">
          {trDynamic(`status.${status}`, dict)}
        </Badge>
      </TableCell>
      <TableCell className="text-right">
        <button
          type="button"
          onClick={onOpen}
          className="font-medium text-blue-600 hover:underline dark:text-blue-400"
        >
          {tr("table.open", dict)}
        </button>
      </TableCell>
    </TableRow>
  );
}

interface SharingEmptyProps {
  readonly filtered: boolean;
  readonly dict: I18nRecord;
  readonly onCreate: () => void;
  readonly onClear: () => void;
}

/** Nothing to list: no share exists yet, or none matches the filters. */
function SharingEmpty({
  filtered,
  dict,
  onCreate,
  onClear,
}: Readonly<SharingEmptyProps>) {
  const key = filtered ? "emptyFiltered" : "emptyNone";
  return (
    <div className="flex flex-col items-center justify-center py-12">
      <EmptyAnimation />
      <p className="mt-10 text-lg text-gray-500 dark:text-gray-400">
        {trDynamic(`${key}.title`, dict)}
      </p>
      <p className="text-sm font-light text-gray-400">
        {trDynamic(`${key}.body`, dict)}
      </p>
      <Button
        color={filtered ? "light" : "blue"}
        size="sm"
        className="mt-4"
        onClick={filtered ? onClear : onCreate}
      >
        {trDynamic(`${key}.action`, dict)}
      </Button>
    </div>
  );
}
