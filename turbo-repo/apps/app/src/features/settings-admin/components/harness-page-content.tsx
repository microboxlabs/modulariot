"use client";

import { useEffect, useMemo, useState, type UIEvent } from "react";
import { Dropdown, DropdownItem } from "flowbite-react";
import {
  HiChip,
  HiChevronDown,
  HiCreditCard,
  HiSearch,
  HiUserCircle,
} from "react-icons/hi";
import {
  HiUserGroup,
  HiCpuChip,
  HiBolt,
  HiExclamationTriangle,
} from "react-icons/hi2";
import type { IconType } from "react-icons";
import { Breadcrumb } from "@/features/common/components/Breadcrumb/Breadcrumb";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr, trDynamic } from "@/features/i18n/tr.service";
import { useOrgScopes } from "@/features/layout/components/secured-navbar/org-switcher/use-org-scopes";
import { useOrgMembers } from "../hooks/use-org-members";
import HarnessSeatsModal, { type BillingCycle } from "./harness-seats-modal";

interface HarnessPageContentProps {
  readonly dict: I18nRecord;
  readonly lang: string;
}

// Mock plan figures — there is no billing/seats backend yet, this page is a
// preview of the Harness pricing/usage/access UI ahead of that integration.
const PRICE_PER_SEAT_USD = 49;
const DEFAULT_SEATS = 25;
const TOKENS_USED = 5_800_000;
const MAX_TOKENS = 8_000_000;
// Extra tokens: once the base pool above runs out, users can top up from an
// on-demand pack purchased separately — priced per million tokens.
const EXTRA_TOKENS_PRICE_PER_MILLION = 10;
const EXTRA_TOKENS_PURCHASED = 2_000_000;
const EXTRA_TOKENS_USED = 800_000;
const MEMBERS_PAGE_SIZE = 10;

// Token pools (base + extra) only ever read as two states: still has room,
// or fully drained — no in-between "approaching" tier.
type UsageStatus = "onTrack" | "atLimit";

function getUsageStatus(used: number, max: number): UsageStatus {
  return max > 0 && used >= max ? "atLimit" : "onTrack";
}

const USAGE_BAR_COLOR: Record<UsageStatus, string> = {
  onTrack: "bg-blue-500",
  atLimit: "bg-red-500",
};

const USAGE_STATUS_TEXT_COLOR: Record<UsageStatus, string> = {
  onTrack: "text-green-600 dark:text-green-400",
  atLimit: "text-red-600 dark:text-red-400",
};

// Seats are a billing-efficiency signal, not a capacity limit like tokens:
// every purchased seat in use is the good outcome (green); a seat you're
// paying for but nobody occupies is the thing to fix (red).
type SeatsStatus = "fullyUsed" | "underused";

function getSeatsStatus(used: number, max: number): SeatsStatus {
  return max > 0 && used >= max ? "fullyUsed" : "underused";
}

const SEATS_BAR_COLOR: Record<SeatsStatus, string> = {
  fullyUsed: "bg-green-500",
  underused: "bg-red-500",
};

const SEATS_STATUS_TEXT_COLOR: Record<SeatsStatus, string> = {
  fullyUsed: "text-green-600 dark:text-green-400",
  underused: "text-red-600 dark:text-red-400",
};

const USAGE_STATUS_DOT_COLOR: Record<UsageStatus, string> = {
  onTrack: "bg-green-500",
  atLimit: "bg-red-500",
};

function formatTokenCount(value: number): string {
  const millions = value / 1_000_000;
  const rounded = Math.round(millions * 10) / 10;
  return `${Number.isInteger(rounded) ? rounded.toFixed(0) : rounded.toFixed(1)}M`;
}

function getBillingPeriodLabel(): string {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const formatter = new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
  });
  return `${formatter.format(start)} – ${formatter.format(end)}`;
}

type PaymentStatus = "paid" | "failed" | "pending";

// Mock — no billing backend yet. Set to "failed" so the unpaid banner and
// the pricing card's status line both demonstrate the not-paid state; swap
// to "paid" to preview the settled state instead.
const LAST_PAYMENT_STATUS: PaymentStatus = "failed";

const PAYMENT_STATUS_COLOR: Record<PaymentStatus, string> = {
  paid: "text-green-600 dark:text-green-400",
  failed: "text-red-600 dark:text-red-400",
  pending: "text-amber-600 dark:text-amber-400",
};

/** One billing cycle back from today, matching whichever cadence is active. */
function getLastPaymentDateLabel(cycle: BillingCycle): string {
  const now = new Date();
  const lastPaymentDate =
    cycle === "yearly"
      ? new Date(now.getFullYear() - 1, now.getMonth(), now.getDate())
      : new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
  }).format(lastPaymentDate);
}

type AccessMode = "all" | "some" | "none";

function getActiveCount(
  accessMode: AccessMode,
  totalMembers: number,
  activeMemberIds: Set<string>
): number {
  if (accessMode === "all") return totalMembers;
  if (accessMode === "none") return 0;
  return activeMemberIds.size;
}

export default function HarnessPageContent({
  dict,
  lang,
}: HarnessPageContentProps) {
  const harnessDict = dict?.harness as I18nRecord;
  const pricingDict = harnessDict?.pricing as I18nRecord;
  // Reuse the seats modal's "/ month" copy for the pricing stats below,
  // instead of a hardcoded English suffix.
  const monthlyUnitDict = pricingDict?.seatsModal as I18nRecord;
  const usageDict = harnessDict?.usage as I18nRecord;
  const seatsUsageDict = usageDict?.seats as I18nRecord;
  const tokensUsageDict = usageDict?.tokens as I18nRecord;
  const extraTokensUsageDict = usageDict?.extraTokens as I18nRecord;
  const accessDict = harnessDict?.access as I18nRecord;
  const breadcrumbDict = dict?.breadcrumb as I18nRecord;

  const { activeOrg } = useOrgScopes();
  const { members, isLoading, error } = useOrgMembers(activeOrg?.slug ?? null);

  const [accessMode, setAccessMode] = useState<AccessMode>("all");
  const [activeMemberIds, setActiveMemberIds] = useState<Set<string>>(
    new Set()
  );
  const [query, setQuery] = useState("");
  const [purchasedSeats, setPurchasedSeats] = useState(DEFAULT_SEATS);
  const [billingCycle, setBillingCycle] = useState<BillingCycle>("monthly");
  const [showSeatsModal, setShowSeatsModal] = useState(false);

  // Default every member to active once the roster loads.
  useEffect(() => {
    setActiveMemberIds(new Set(members.map((member) => member.id)));
  }, [members]);

  const setMemberActive = (memberId: string, active: boolean) => {
    setActiveMemberIds((current) => {
      const next = new Set(current);
      if (active) next.add(memberId);
      else next.delete(memberId);
      return next;
    });
  };

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

  // Render the member list 10 at a time, growing as the user scrolls near
  // the bottom of the scroll container, instead of mounting every row.
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

  const activeCount = getActiveCount(
    accessMode,
    members.length,
    activeMemberIds
  );
  // Seats "used" tracks active members, not the whole roster — deactivating
  // someone in the access list below frees up their seat immediately.
  const seatsUsed = Math.min(activeCount, purchasedSeats);
  const estimatedTotal = purchasedSeats * PRICE_PER_SEAT_USD;

  const seatsStatus = getSeatsStatus(seatsUsed, purchasedSeats);
  const tokensStatus = getUsageStatus(TOKENS_USED, MAX_TOKENS);
  const extraTokensStatus = getUsageStatus(
    EXTRA_TOKENS_USED,
    EXTRA_TOKENS_PURCHASED
  );
  const extraTokensCost =
    (EXTRA_TOKENS_PURCHASED / 1_000_000) * EXTRA_TOKENS_PRICE_PER_MILLION;
  const billingPeriodLabel = useMemo(getBillingPeriodLabel, []);
  const lastPaymentDateLabel = useMemo(
    () => getLastPaymentDateLabel(billingCycle),
    [billingCycle]
  );

  return (
    // Same shell as Settings > Credentials / Data sources / Connections: a
    // full-width breadcrumb bar (outside the scroll container, so it never
    // moves — including during rubber-band overscroll) over a capped,
    // independently-scrolling content column.
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

        {LAST_PAYMENT_STATUS !== "paid" && (
          <div className="flex items-center justify-between gap-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-900/50 dark:bg-amber-900/20">
            <div className="flex min-w-0 items-center gap-2.5">
              <HiExclamationTriangle className="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
              <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
                {tr("unpaidAlert", harnessDict)}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowSeatsModal(true)}
              className="shrink-0 rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
            >
              {tr("unpaidAlertAction", harnessDict)}
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {/* Pricing */}
          <section className="flex flex-col rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
            <div className="flex items-center gap-3 border-b border-gray-200 px-4 py-3 dark:border-gray-700">
              <IconTile icon={HiCreditCard} />
              <div className="min-w-0 flex-1">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-900 dark:text-white">
                  {tr("title", pricingDict)}
                </h2>
                <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                  {tr("description", pricingDict)}
                </p>
              </div>
            </div>

            <div className="flex-1 grid grid-cols-1 gap-4 px-4 py-3 lg:grid-cols-3">
              <div>
                <p className="text-xs text-gray-400 dark:text-gray-500">
                  {tr("estimatedTotalLabel", pricingDict)}{" "}
                  <button
                    type="button"
                    onClick={() => setShowSeatsModal(true)}
                    className="font-semibold text-blue-600 underline decoration-dotted underline-offset-2 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                  >
                    {tr("seatsLabel", pricingDict, {
                      count: String(purchasedSeats),
                    })}
                  </button>
                </p>
                <div className="mt-1 flex items-baseline gap-1.5">
                  <span className="text-2xl font-semibold tracking-tight text-gray-900 dark:text-white sm:text-3xl">
                    ${estimatedTotal.toLocaleString()}
                  </span>
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    {tr("monthlyUnit", monthlyUnitDict)}
                  </span>
                </div>
              </div>

              <div>
                <p className="text-xs text-gray-400 dark:text-gray-500">
                  {tr("perSeatLabel", pricingDict)}
                </p>
                <div className="mt-1 flex items-baseline gap-1.5">
                  <span className="text-2xl font-semibold tracking-tight text-gray-900 dark:text-white sm:text-3xl">
                    ${PRICE_PER_SEAT_USD}
                  </span>
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    {tr("monthlyUnit", monthlyUnitDict)}
                  </span>
                </div>
              </div>

              <div>
                <p className="text-xs text-gray-400 dark:text-gray-500">
                  {tr("extraTokensLabel", pricingDict)}
                </p>
                <div className="mt-1 flex items-baseline gap-1.5">
                  <span className="text-2xl font-semibold tracking-tight text-gray-900 dark:text-white sm:text-3xl">
                    ${extraTokensCost.toLocaleString()}
                  </span>
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    {tr("monthlyUnit", monthlyUnitDict)}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-gray-100 px-4 py-3 dark:border-gray-700/60">
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {tr("lastPaymentLabel", pricingDict)} $
                {estimatedTotal.toLocaleString()} · {lastPaymentDateLabel}
              </span>
              <span
                className={`text-xs font-medium ${PAYMENT_STATUS_COLOR[LAST_PAYMENT_STATUS]}`}
              >
                {trDynamic(`paymentStatus.${LAST_PAYMENT_STATUS}`, pricingDict)}
              </span>
            </div>
          </section>

          {/* Team seats */}
          <section className="flex flex-col rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
            <div className="flex items-center gap-3 border-b border-gray-200 px-4 py-3 dark:border-gray-700">
              <IconTile icon={HiUserGroup} />
              <div className="min-w-0 flex-1">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-900 dark:text-white">
                  {tr("title", seatsUsageDict)}
                </h2>
                <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                  {tr("description", seatsUsageDict)}
                </p>
              </div>
            </div>

            <div className="flex-1 px-4 py-3">
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">
                  {seatsUsed}
                </span>
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  / {purchasedSeats} {tr("unitLabel", seatsUsageDict)}
                </span>
              </div>
              <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
                <div
                  className={`h-full rounded-full transition-all duration-500 ease-out ${SEATS_BAR_COLOR[seatsStatus]}`}
                  style={{
                    width: `${Math.min(100, (seatsUsed / purchasedSeats) * 100)}%`,
                  }}
                />
              </div>
            </div>

            <div className="flex items-center justify-between border-t border-gray-100 px-4 py-3 dark:border-gray-700/60">
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {tr("remaining", seatsUsageDict, {
                  count: String(Math.max(0, purchasedSeats - seatsUsed)),
                })}
              </span>
              <span
                className={`text-xs font-medium ${SEATS_STATUS_TEXT_COLOR[seatsStatus]}`}
              >
                {trDynamic(`status.${seatsStatus}`, seatsUsageDict)}
              </span>
            </div>
          </section>

          {/* Tokens */}
          <section className="flex flex-col rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
            <div className="flex items-center gap-3 border-b border-gray-200 px-4 py-3 dark:border-gray-700">
              <IconTile icon={HiCpuChip} />
              <div className="min-w-0 flex-1">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-900 dark:text-white">
                  {tr("title", tokensUsageDict)}
                </h2>
                <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                  {billingPeriodLabel}
                </p>
              </div>
            </div>

            <div className="flex-1 px-4 py-3">
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">
                  {formatTokenCount(TOKENS_USED)}
                </span>
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  / {formatTokenCount(MAX_TOKENS)}{" "}
                  {tr("unitLabel", tokensUsageDict)}
                </span>
              </div>
              <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
                <div
                  className={`h-full rounded-full transition-all duration-500 ease-out ${USAGE_BAR_COLOR[tokensStatus]}`}
                  style={{
                    width: `${Math.min(100, (TOKENS_USED / MAX_TOKENS) * 100)}%`,
                  }}
                />
              </div>
            </div>

            <div className="flex items-center justify-between border-t border-gray-100 px-4 py-3 dark:border-gray-700/60">
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {tr("remaining", tokensUsageDict, {
                  count: formatTokenCount(
                    Math.max(0, MAX_TOKENS - TOKENS_USED)
                  ),
                })}
              </span>
              <span
                className={`flex items-center gap-1.5 text-xs font-medium ${USAGE_STATUS_TEXT_COLOR[tokensStatus]}`}
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${USAGE_STATUS_DOT_COLOR[tokensStatus]}`}
                />
                {trDynamic(`status.${tokensStatus}`, tokensUsageDict)}
              </span>
            </div>
          </section>

          {/* Extra tokens */}
          <section className="flex flex-col rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
            <div className="flex items-center gap-3 border-b border-gray-200 px-4 py-3 dark:border-gray-700">
              <IconTile icon={HiBolt} />
              <div className="min-w-0 flex-1">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-900 dark:text-white">
                  {tr("title", extraTokensUsageDict)}
                </h2>
                <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                  {tr("description", extraTokensUsageDict)}
                </p>
              </div>
            </div>

            <div className="flex-1 px-4 py-3">
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">
                  {formatTokenCount(EXTRA_TOKENS_USED)}
                </span>
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  / {formatTokenCount(EXTRA_TOKENS_PURCHASED)}{" "}
                  {tr("unitLabel", extraTokensUsageDict)}
                </span>
              </div>
              <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
                <div
                  className={`h-full rounded-full transition-all duration-500 ease-out ${USAGE_BAR_COLOR[extraTokensStatus]}`}
                  style={{
                    width: `${Math.min(100, (EXTRA_TOKENS_USED / EXTRA_TOKENS_PURCHASED) * 100)}%`,
                  }}
                />
              </div>
            </div>

            <div className="flex items-center justify-between border-t border-gray-100 px-4 py-3 dark:border-gray-700/60">
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {tr("remaining", extraTokensUsageDict, {
                  count: formatTokenCount(
                    Math.max(0, EXTRA_TOKENS_PURCHASED - EXTRA_TOKENS_USED)
                  ),
                })}
              </span>
              <span
                className={`flex items-center gap-1.5 text-xs font-medium ${USAGE_STATUS_TEXT_COLOR[extraTokensStatus]}`}
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${USAGE_STATUS_DOT_COLOR[extraTokensStatus]}`}
                />
                {trDynamic(`status.${extraTokensStatus}`, extraTokensUsageDict)}
              </span>
            </div>
          </section>
        </div>

        {/* User access */}
        <section className="shrink-0 rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
          <div className="flex items-center gap-3 border-b border-gray-200 px-4 py-3 dark:border-gray-700">
            <IconTile icon={HiUserCircle} />
            <div className="min-w-0 flex-1">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-900 dark:text-white">
                {tr("title", accessDict)}
              </h2>
              <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                {tr("description", accessDict)}
              </p>
            </div>
            {!isLoading && !error && (
              <span className="shrink-0 rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-600 dark:bg-gray-700 dark:text-gray-300">
                {tr("activeCount", accessDict, {
                  count: String(activeCount),
                  total: String(members.length),
                })}
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 px-4 py-3 dark:border-gray-700">
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-gray-900 dark:text-white">
                {tr("enabledForLabel", accessDict)}
              </span>
              <OptionDropdown
                value={accessMode}
                onChange={(value) => setAccessMode(value as AccessMode)}
                ariaLabel={tr("enabledForLabel", accessDict)}
                options={[
                  { value: "all", label: tr("enabledAllOption", accessDict) },
                  {
                    value: "some",
                    label: tr("enabledSomeOption", accessDict),
                  },
                  {
                    value: "none",
                    label: tr("enabledNoneOption", accessDict),
                  },
                ]}
                triggerClassName="flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
              />
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
                const isActive =
                  accessMode === "all" ||
                  (accessMode === "some" && activeMemberIds.has(member.id));
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
                          setMemberActive(member.id, value === "active")
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

      <HarnessSeatsModal
        show={showSeatsModal}
        currentSeats={purchasedSeats}
        currentBillingCycle={billingCycle}
        minSeats={Math.max(1, members.length)}
        pricePerSeat={PRICE_PER_SEAT_USD}
        onClose={() => setShowSeatsModal(false)}
        onSave={(seats, cycle) => {
          setPurchasedSeats(seats);
          setBillingCycle(cycle);
          setShowSeatsModal(false);
        }}
        dict={pricingDict?.seatsModal as I18nRecord}
      />
    </div>
  );
}

/** Square tile wrapper so section-header icons read bigger without upsizing the glyph itself. */
function IconTile({ icon: Icon }: { readonly icon: IconType }) {
  return (
    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-700">
      <Icon className="h-5 w-5 text-gray-500 dark:text-gray-400" />
    </div>
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
          aria-label={ariaLabel}
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
