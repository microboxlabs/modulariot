"use client";

import { useEffect, useMemo, useState, type UIEvent } from "react";
import { Button, Dropdown, DropdownItem, Spinner } from "flowbite-react";
import {
  HiChip,
  HiChevronDown,
  HiCreditCard,
  HiSearch,
  HiUserCircle,
} from "react-icons/hi";
import {
  HiChartBar,
  HiCpuChip,
  HiInformationCircle,
  HiUserGroup,
} from "react-icons/hi2";
import { toast } from "sonner";
import { Breadcrumb } from "@/features/common/components/Breadcrumb/Breadcrumb";
import { IconTile } from "@/features/common/components/icon-tile/icon-tile";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr, trDynamic } from "@/features/i18n/tr.service";
import { useOrgScopes } from "@/features/layout/components/secured-navbar/org-switcher/use-org-scopes";
import { ApiError } from "../data/json-client";
import { useOrgMembers } from "../hooks/use-org-members";
import type {
  AccessMode,
  BillingCycle,
  PoolUse,
  SetHarnessSubscription,
} from "../harness/harness-plan.types";
import {
  activeCount,
  billingTotal,
  formatTokens,
  normalizeEmail,
  poolPercent,
  seatPriceFor,
} from "../harness/harness-plan-view";
import { useOrgHarnessPlan } from "../harness/use-org-harness-plan";
import HarnessSeatsModal from "./harness-seats-modal";

interface HarnessPageContentProps {
  readonly dict: I18nRecord;
  readonly lang: string;
}

const MEMBERS_PAGE_SIZE = 10;

const cardClass =
  "flex flex-col rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800";
const cardHeaderClass =
  "flex items-center gap-3 border-b border-gray-200 px-4 py-3 dark:border-gray-700";
const cardTitleClass =
  "text-sm font-semibold uppercase tracking-wide text-gray-900 dark:text-white";

/**
 * Settings › Harness: the organization's seats, who may use the assistant, and
 * this month's shared token pool. Each seat adds the plan's tokens to the pool;
 * a model's tokens count times its multiplier.
 */
export default function HarnessPageContent({
  dict,
  lang,
}: HarnessPageContentProps) {
  const harnessDict = dict?.harness as I18nRecord;
  const pricingDict = harnessDict?.pricing as I18nRecord;
  const seatsModalDict = pricingDict?.seatsModal as I18nRecord;
  const usageDict = harnessDict?.usage as I18nRecord;
  const seatsUsageDict = usageDict?.seats as I18nRecord;
  const tokensUsageDict = usageDict?.tokens as I18nRecord;
  const breakdownDict = usageDict?.breakdown as I18nRecord;
  const accessDict = harnessDict?.access as I18nRecord;
  const breadcrumbDict = dict?.breadcrumb as I18nRecord;

  const { activeOrg } = useOrgScopes();
  const orgSlug = activeOrg?.slug ?? null;
  const { members, isLoading, error } = useOrgMembers(orgSlug);
  const planState = useOrgHarnessPlan(orgSlug);
  const data = planState.data;
  const subscription = data?.subscription ?? null;

  const [accessMode, setAccessMode] = useState<AccessMode>("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");
  const [showSeatsModal, setShowSeatsModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // The saved access is the starting point; edits stay local until saved.
  useEffect(() => {
    setAccessMode(subscription?.accessMode ?? "all");
    setSelected(new Set(subscription?.members ?? []));
  }, [subscription]);

  const normalizedQuery = query.trim().toLocaleLowerCase();
  const filteredMembers = useMemo(
    () =>
      members.filter((member) => {
        if (!normalizedQuery) return true;
        return [member.displayName, member.email].some((value) =>
          value?.toLocaleLowerCase().includes(normalizedQuery)
        );
      }),
    [members, normalizedQuery]
  );

  const [visibleCount, setVisibleCount] = useState(MEMBERS_PAGE_SIZE);
  useEffect(() => {
    setVisibleCount(MEMBERS_PAGE_SIZE);
  }, [normalizedQuery, members]);
  const visibleMembers = filteredMembers.slice(0, visibleCount);

  const handleMemberListScroll = (event: UIEvent<HTMLDivElement>) => {
    const el = event.currentTarget;
    if (el.scrollHeight - el.scrollTop - el.clientHeight > 96) return;
    setVisibleCount((count) =>
      Math.min(count + MEMBERS_PAGE_SIZE, filteredMembers.length)
    );
  };

  const memberEmails = useMemo(
    () => new Set(members.map((m) => normalizeEmail(m.email))),
    [members]
  );
  const selectedMembers = [...selected].filter((e) => memberEmails.has(e));
  const active = activeCount(
    accessMode,
    members.length,
    selectedMembers.length
  );
  const seats = subscription?.seats ?? 0;
  const tooFewSeats = subscription !== null && active > seats;
  const accessDirty =
    subscription !== null &&
    (accessMode !== subscription.accessMode ||
      (accessMode === "some" &&
        !sameSet(selectedMembers, subscription.members)));

  const setMemberActive = (email: string, isActive: boolean) => {
    setSelected((current) => {
      const next = new Set(current);
      if (isActive) next.add(email);
      else next.delete(email);
      return next;
    });
  };

  const save = async (value: SetHarnessSubscription) => {
    setIsSaving(true);
    try {
      await planState.save(value);
      toast.success(tr("saved", harnessDict));
      return true;
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : tr("saveError", harnessDict)
      );
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const saveAccess = () =>
    void save({
      seats,
      billingCycle: subscription?.billingCycle ?? "monthly",
      accessMode,
      members: accessMode === "some" ? selectedMembers : [],
    });

  const saveSeats = async (nextSeats: number, cycle: BillingCycle) => {
    const ok = await save({
      seats: nextSeats,
      billingCycle: cycle,
      accessMode,
      members: accessMode === "some" ? selectedMembers : [],
    });
    if (ok) setShowSeatsModal(false);
  };

  const cycle = subscription?.billingCycle ?? "monthly";
  const recurringUnitKey = cycle === "yearly" ? "yearlyUnit" : "monthlyUnit";
  const pool = data?.pool;
  const periodLabel = useMemo(() => {
    if (!pool) return "";
    const fmt = new Intl.DateTimeFormat(lang, {
      month: "short",
      day: "numeric",
      timeZone: "UTC",
    });
    const end = new Date(new Date(pool.periodEnd).getTime() - 1);
    return `${fmt.format(new Date(pool.periodStart))} – ${fmt.format(end)}`;
  }, [pool, lang]);
  const poolExhausted = pool !== undefined && pool.used >= pool.included;
  const memberName = useMemo(() => {
    const byEmail = new Map(
      members.map((m) => [normalizeEmail(m.email), m.displayName || m.email])
    );
    return (key: string) => byEmail.get(normalizeEmail(key)) ?? key;
  }, [members]);

  return (
    <div className="flex h-full w-full flex-col overflow-hidden">
      <div className="flex w-full items-center justify-between border-b border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-900 dark:text-white">
        <Breadcrumb
          dict={breadcrumbDict}
          lang={lang}
          path={["user", "settings", "harness"]}
          disableLinks
        />
      </div>

      <div className="mx-auto flex w-full max-w-screen-2xl flex-1 min-h-0 flex-col gap-4 overflow-y-auto px-4 pt-2 pb-6 dark:bg-gray-900">
        <div className="flex items-center gap-3">
          <IconTile icon={HiChip} />
          <div>
            <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
              {tr("title", harnessDict)}
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {tr("description", harnessDict)}
            </p>
          </div>
        </div>

        {planState.isLoading && <Spinner size="md" />}
        {planState.error && (
          <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-900/20 dark:text-red-300">
            {planState.error.status === 403
              ? tr("forbidden", harnessDict)
              : tr("loadError", harnessDict)}
          </p>
        )}

        {data && !data.enforced && (
          <div className="flex items-center gap-2.5 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 dark:border-blue-900/50 dark:bg-blue-900/20">
            <HiInformationCircle className="h-5 w-5 shrink-0 text-blue-600 dark:text-blue-400" />
            <p className="text-sm text-blue-800 dark:text-blue-300">
              {tr("notEnforced", harnessDict)}
            </p>
          </div>
        )}

        {data && !subscription && (
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-900/50 dark:bg-amber-900/20">
            <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
              {tr("noSubscription", harnessDict, {
                price: String(data.plan.seatPriceUsd),
                tokens: formatTokens(data.plan.tokensPerSeat),
              })}
            </p>
            <Button
              size="sm"
              color="blue"
              onClick={() => setShowSeatsModal(true)}
            >
              {tr("chooseSeats", harnessDict)}
            </Button>
          </div>
        )}

        {data && poolExhausted && subscription && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700 dark:border-red-900/50 dark:bg-red-900/20 dark:text-red-300">
            {tr("poolExhausted", harnessDict)}
          </div>
        )}

        {data && (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            {/* Pricing */}
            <section className={cardClass}>
              <div className={cardHeaderClass}>
                <IconTile icon={HiCreditCard} />
                <div className="min-w-0 flex-1">
                  <h2 className={cardTitleClass}>{tr("title", pricingDict)}</h2>
                  <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                    {tr("description", pricingDict)}
                  </p>
                </div>
              </div>
              <div className="grid flex-1 grid-cols-2 gap-4 px-4 py-3">
                <div>
                  <p className="text-xs text-gray-400 dark:text-gray-500">
                    {tr("estimatedTotalLabel", pricingDict)}{" "}
                    <button
                      type="button"
                      onClick={() => setShowSeatsModal(true)}
                      className="font-semibold text-blue-600 underline decoration-dotted underline-offset-2 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                    >
                      {tr("seatsLabel", pricingDict, { count: String(seats) })}
                    </button>
                  </p>
                  <p className="mt-1 flex items-baseline gap-1.5">
                    <span className="text-2xl font-semibold tracking-tight text-gray-900 dark:text-white">
                      ${billingTotal(seats, data.plan, cycle).toLocaleString()}
                    </span>
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      {trDynamic(recurringUnitKey, seatsModalDict)}
                    </span>
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 dark:text-gray-500">
                    {tr("perSeatLabel", pricingDict)}
                  </p>
                  <p className="mt-1 flex items-baseline gap-1.5">
                    <span className="text-2xl font-semibold tracking-tight text-gray-900 dark:text-white">
                      ${seatPriceFor(data.plan, cycle)}
                    </span>
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      {tr("monthlyUnit", seatsModalDict)}
                    </span>
                  </p>
                </div>
              </div>
              <div className="border-t border-gray-100 px-4 py-3 text-xs text-gray-500 dark:border-gray-700/60 dark:text-gray-400">
                {tr("tokensPerSeat", pricingDict, {
                  tokens: formatTokens(data.plan.tokensPerSeat),
                })}
              </div>
            </section>

            {/* Seats */}
            <section className={cardClass}>
              <div className={cardHeaderClass}>
                <IconTile icon={HiUserGroup} />
                <div className="min-w-0 flex-1">
                  <h2 className={cardTitleClass}>
                    {tr("title", seatsUsageDict)}
                  </h2>
                  <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                    {tr("description", seatsUsageDict)}
                  </p>
                </div>
              </div>
              <div className="flex-1 px-4 py-3">
                <p className="flex items-baseline gap-1">
                  <span className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">
                    {active}
                  </span>
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    / {seats} {tr("unitLabel", seatsUsageDict)}
                  </span>
                </p>
                <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
                  <div
                    className={`h-full rounded-full ${tooFewSeats ? "bg-red-500" : "bg-green-500"}`}
                    style={{ width: `${poolPercent(active, seats)}%` }}
                  />
                </div>
              </div>
              <div className="border-t border-gray-100 px-4 py-3 text-xs text-gray-500 dark:border-gray-700/60 dark:text-gray-400">
                {tooFewSeats
                  ? tr("tooFew", seatsUsageDict, {
                      count: String(active - seats),
                    })
                  : tr("remaining", seatsUsageDict, {
                      count: String(Math.max(0, seats - active)),
                    })}
              </div>
            </section>

            {/* Token pool */}
            <section className={cardClass}>
              <div className={cardHeaderClass}>
                <IconTile icon={HiCpuChip} />
                <div className="min-w-0 flex-1">
                  <h2 className={cardTitleClass}>
                    {tr("title", tokensUsageDict)}
                  </h2>
                  <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                    {periodLabel}
                  </p>
                </div>
              </div>
              <div className="flex-1 px-4 py-3">
                <p className="flex items-baseline gap-1">
                  <span className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">
                    {formatTokens(data.pool.used)}
                  </span>
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    / {formatTokens(data.pool.included)}{" "}
                    {tr("unitLabel", tokensUsageDict)}
                  </span>
                </p>
                <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
                  <div
                    className={`h-full rounded-full ${poolExhausted ? "bg-red-500" : "bg-blue-500"}`}
                    style={{
                      width: `${poolPercent(data.pool.used, data.pool.included)}%`,
                    }}
                  />
                </div>
              </div>
              <div className="border-t border-gray-100 px-4 py-3 text-xs text-gray-500 dark:border-gray-700/60 dark:text-gray-400">
                {tr("remaining", tokensUsageDict, {
                  count: formatTokens(
                    Math.max(0, data.pool.included - data.pool.used)
                  ),
                })}
                {" · "}
                {tr("multiplierHelp", tokensUsageDict)}
              </div>
            </section>
          </div>
        )}

        {data && (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <UsageTable
              title={tr("byModel", breakdownDict)}
              keyLabel={tr("model", breakdownDict)}
              rows={data.pool.byModel}
              label={(key) => key}
              dict={breakdownDict}
            />
            <UsageTable
              title={tr("byMember", breakdownDict)}
              keyLabel={tr("member", breakdownDict)}
              rows={data.pool.byMember}
              label={memberName}
              dict={breakdownDict}
            />
          </div>
        )}

        {/* User access */}
        <section className="shrink-0 rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
          <div className={cardHeaderClass}>
            <IconTile icon={HiUserCircle} />
            <div className="min-w-0 flex-1">
              <h2 className={cardTitleClass}>{tr("title", accessDict)}</h2>
              <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                {tr("description", accessDict)}
              </p>
            </div>
            {!isLoading && !error && (
              <span className="shrink-0 text-xs font-medium text-gray-500 dark:text-gray-400">
                {tr("activeCount", accessDict, {
                  count: String(active),
                  total: String(members.length),
                })}
              </span>
            )}
          </div>

          <div className="flex flex-col gap-3 border-b border-gray-200 px-4 py-3 dark:border-gray-700 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-gray-900 dark:text-white">
                {tr("enabledForLabel", accessDict)}
              </span>
              <OptionDropdown
                value={accessMode}
                onChange={(value) => setAccessMode(value as AccessMode)}
                ariaLabel={tr("enabledForLabel", accessDict)}
                disabled={!subscription}
                options={[
                  { value: "all", label: tr("enabledAllOption", accessDict) },
                  { value: "some", label: tr("enabledSomeOption", accessDict) },
                  { value: "none", label: tr("enabledNoneOption", accessDict) },
                ]}
                triggerClassName="flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
              />
              <Button
                size="xs"
                color="blue"
                disabled={!accessDirty || tooFewSeats || isSaving}
                onClick={saveAccess}
              >
                {tr("save", accessDict)}
              </Button>
            </div>

            <label className="relative block w-full sm:w-72">
              <span className="sr-only">{tr("searchLabel", accessDict)}</span>
              <HiSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={tr("searchPlaceholder", accessDict)}
                className="w-full rounded-md border border-gray-300 bg-white py-2 pl-9 pr-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
              />
            </label>
          </div>

          {tooFewSeats && (
            <p className="border-b border-gray-200 px-4 py-2 text-xs text-red-600 dark:border-gray-700 dark:text-red-400">
              {tr("tooFewSeats", accessDict, { seats: String(seats) })}
            </p>
          )}

          {isLoading && (
            <p className="px-4 py-5 text-sm text-gray-500 dark:text-gray-400">
              {tr("loading", accessDict)}
            </p>
          )}
          {!isLoading && error && (
            <p className="px-4 py-5 text-sm text-red-600 dark:text-red-400">
              {tr("loadError", accessDict)}
            </p>
          )}
          {!isLoading && !error && (
            <div
              className="max-h-96 overflow-y-auto overscroll-contain rounded-b-lg"
              onScroll={handleMemberListScroll}
            >
              <div className="sticky top-0 z-1 hidden grid-cols-[minmax(0,1fr)_10rem] gap-3 border-b border-gray-200 bg-gray-50 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400 sm:grid">
                <span>{tr("memberColumn", accessDict)}</span>
                <span className="text-right">
                  {tr("statusColumn", accessDict)}
                </span>
              </div>
              {visibleMembers.map((member) => {
                const email = normalizeEmail(member.email);
                const isActive =
                  accessMode === "all" ||
                  (accessMode === "some" && selected.has(email));
                return (
                  <div
                    key={member.id}
                    className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-gray-100 px-4 py-3 last:border-b-0 dark:border-gray-700 sm:grid-cols-[minmax(0,1fr)_10rem]"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <HiUserCircle className="h-8 w-8 shrink-0 text-gray-400 dark:text-gray-500" />
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium text-gray-900 dark:text-white">
                          {member.displayName || member.email}
                        </span>
                        <span className="block truncate text-xs text-gray-500 dark:text-gray-400">
                          {member.email}
                        </span>
                      </span>
                    </div>
                    <div className="flex items-center justify-end gap-3">
                      <OptionDropdown
                        value={isActive ? "active" : "inactive"}
                        onChange={(value) =>
                          setMemberActive(email, value === "active")
                        }
                        disabled={accessMode !== "some"}
                        ariaLabel={member.displayName || member.email}
                        options={[
                          {
                            value: "active",
                            label: tr(
                              "active",
                              accessDict.status as I18nRecord
                            ),
                          },
                          {
                            value: "inactive",
                            label: tr(
                              "inactive",
                              accessDict.status as I18nRecord
                            ),
                          },
                        ]}
                        triggerClassName={`flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-medium disabled:cursor-not-allowed disabled:opacity-70 ${
                          isActive
                            ? "border-green-300 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-900/20 dark:text-green-400"
                            : "border-gray-300 bg-white text-gray-600 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-300"
                        }`}
                      />
                    </div>
                  </div>
                );
              })}
              {filteredMembers.length === 0 && (
                <p className="px-4 py-6 text-center text-sm text-gray-500 dark:text-gray-400">
                  {members.length === 0
                    ? tr("empty", accessDict)
                    : tr("noSearchResults", accessDict)}
                </p>
              )}
            </div>
          )}
        </section>
      </div>

      {data && (
        <HarnessSeatsModal
          show={showSeatsModal}
          currentSeats={seats}
          currentBillingCycle={cycle}
          minSeats={Math.max(1, active)}
          plan={data.plan}
          isSaving={isSaving}
          onClose={() => setShowSeatsModal(false)}
          onSave={(nextSeats, nextCycle) =>
            void saveSeats(nextSeats, nextCycle)
          }
          dict={seatsModalDict}
        />
      )}
    </div>
  );
}

function sameSet(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false;
  const set = new Set(b);
  return a.every((x) => set.has(x));
}

interface UsageTableProps {
  readonly title: string;
  readonly keyLabel: string;
  readonly rows: PoolUse[];
  readonly label: (key: string) => string;
  readonly dict: I18nRecord;
}

/** Runs, tokens and pool tokens per model or per member this month. */
function UsageTable({ title, keyLabel, rows, label, dict }: UsageTableProps) {
  return (
    <section className={cardClass}>
      <div className={cardHeaderClass}>
        <IconTile icon={HiChartBar} />
        <h2 className={cardTitleClass}>{title}</h2>
      </div>
      {rows.length === 0 ? (
        <p className="px-4 py-4 text-sm text-gray-500 dark:text-gray-400">
          {tr("empty", dict)}
        </p>
      ) : (
        <table className="w-full text-left text-xs text-gray-600 dark:text-gray-300">
          <thead className="text-gray-500 dark:text-gray-400">
            <tr>
              <th className="px-4 py-2 font-medium">{keyLabel}</th>
              <th className="px-4 py-2 text-right font-medium">
                {tr("runs", dict)}
              </th>
              <th className="px-4 py-2 text-right font-medium">
                {tr("tokens", dict)}
              </th>
              <th className="px-4 py-2 text-right font-medium">
                {tr("poolTokens", dict)}
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.key}
                className="border-t border-gray-100 dark:border-gray-700"
              >
                <td className="truncate px-4 py-2 font-mono">
                  {row.key ? label(row.key) : tr("machine", dict)}
                </td>
                <td className="px-4 py-2 text-right">{row.runs}</td>
                <td className="px-4 py-2 text-right">
                  {formatTokens(row.tokens)}
                </td>
                <td className="px-4 py-2 text-right">
                  {formatTokens(row.poolTokens)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

interface OptionDropdownProps {
  readonly value: string;
  readonly options: { value: string; label: string }[];
  readonly onChange: (value: string) => void;
  readonly triggerClassName: string;
  readonly disabled?: boolean;
  readonly ariaLabel?: string;
}

/** Flowbite Dropdown styled as a compact value picker, in place of a native select. */
function OptionDropdown({
  value,
  options,
  onChange,
  triggerClassName,
  disabled,
  ariaLabel,
}: OptionDropdownProps) {
  const current = options.find((option) => option.value === value);

  return (
    <Dropdown
      label=""
      dismissOnClick
      inline
      renderTrigger={() => (
        <button
          type="button"
          disabled={disabled}
          aria-label={
            ariaLabel ? `${ariaLabel}: ${current?.label ?? ""}` : undefined
          }
          className={triggerClassName}
        >
          {current?.label}
          <HiChevronDown className="h-3.5 w-3.5 shrink-0 text-gray-400" />
        </button>
      )}
    >
      {options.map((option) => (
        <DropdownItem key={option.value} onClick={() => onChange(option.value)}>
          {option.label}
        </DropdownItem>
      ))}
    </Dropdown>
  );
}
