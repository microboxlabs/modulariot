"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Button,
  Label,
  Select,
  Spinner,
  TextInput,
  ToggleSwitch,
} from "flowbite-react";
import { HiOutlineMap } from "react-icons/hi";
import { toast } from "sonner";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr, trDynamic } from "@/features/i18n/tr.service";
import type { OrgGeocodingUsage } from "@/features/geocoding/geocoding-plan.types";
import { ApiError } from "../data/json-client";
import {
  geocodingPlanDraftFrom,
  subscriptionDraftFrom,
  toGeocodingPlanRequest,
  toSubscriptionRequest,
  type GeocodingPlanDraft,
  type GeocodingPlanError,
  type SubscriptionDraft,
} from "./geocoding-plan-form";
import {
  useGeocodingPlan,
  useGeocodingSubscriptions,
} from "./use-geocoding-plan";
import { usePlatformOrganizations } from "./use-platform-organizations";

interface GeocodingPlanSectionProps {
  readonly dict: I18nRecord;
}

const SECTION =
  "rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800";

function currentMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

/**
 * The geocoding plan: prices, the default monthly quota, the alert share and
 * whether quotas are applied; and each organization's quota.
 */
export default function GeocodingPlanSection({
  dict,
}: GeocodingPlanSectionProps) {
  return (
    <>
      <PlanCard dict={dict} />
      <SubscriptionsCard dict={dict} />
    </>
  );
}

function PlanCard({ dict }: GeocodingPlanSectionProps) {
  const { plan, isLoading, error, save } = useGeocodingPlan();
  const [draft, setDraft] = useState<GeocodingPlanDraft | null>(null);
  const [problem, setProblem] = useState<GeocodingPlanError | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (plan) setDraft(geocodingPlanDraftFrom(plan));
  }, [plan]);

  const submit = async () => {
    if (!draft) return;
    const result = toGeocodingPlanRequest(draft);
    if (!result.ok) {
      setProblem(result.error);
      return;
    }
    setProblem(null);
    setIsSaving(true);
    try {
      await save(result.value);
      toast.success(tr("saved", dict));
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : tr("saveError", dict)
      );
    } finally {
      setIsSaving(false);
    }
  };

  const field = (
    id: string,
    key: keyof Omit<GeocodingPlanDraft, "enforced">,
    label: string
  ) =>
    draft && (
      <div>
        <Label htmlFor={id}>{label}</Label>
        <TextInput
          id={id}
          inputMode="decimal"
          value={draft[key]}
          onChange={(e) => setDraft({ ...draft, [key]: e.target.value })}
        />
      </div>
    );

  return (
    <section className={SECTION}>
      <div className="flex items-center gap-2">
        <HiOutlineMap className="h-5 w-5 text-blue-500" />
        <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
          {tr("title", dict)}
        </h2>
      </div>
      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
        {tr("description", dict)}
      </p>

      {isLoading && <Spinner size="sm" className="mt-3" />}
      {error && (
        <p className="mt-3 text-sm text-red-600 dark:text-red-400">
          {tr("loadError", dict)}
        </p>
      )}

      {draft && (
        <>
          <div className="mt-4">
            <ToggleSwitch
              checked={draft.enforced}
              label={tr("enforced", dict)}
              onChange={(enforced) => setDraft({ ...draft, enforced })}
            />
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              {draft.enforced
                ? tr("enforcedOn", dict)
                : tr("enforcedOff", dict)}
            </p>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
            {field(
              "geo-plan-quota",
              "resolutionsPerMonth",
              tr("resolutions", dict)
            )}
            {field("geo-plan-alert", "alertPct", tr("alertPct", dict))}
            {field(
              "geo-plan-price",
              "monthlyPriceUsd",
              tr("monthlyPrice", dict)
            )}
            {field(
              "geo-plan-overage",
              "overagePriceUsd",
              tr("overagePrice", dict)
            )}
          </div>
          <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
            {tr("countHelp", dict)}
          </p>

          {problem && (
            <p className="mt-3 text-sm text-red-600 dark:text-red-400">
              {trDynamic(`errors.${problem}`, dict)}
            </p>
          )}

          <div className="mt-4 flex justify-end">
            <Button
              size="sm"
              color="blue"
              disabled={isSaving}
              onClick={() => void submit()}
            >
              {isSaving ? tr("saving", dict) : tr("save", dict)}
            </Button>
          </div>
        </>
      )}
    </section>
  );
}

function SubscriptionsCard({ dict }: GeocodingPlanSectionProps) {
  const month = currentMonth();
  const { organizations, isLoading, error, saveSubscription } =
    useGeocodingSubscriptions(month);
  const { organizations: all } = usePlatformOrganizations(true);
  const [adding, setAdding] = useState("");

  const names = useMemo(() => new Map(all.map((o) => [o.slug, o.name])), [all]);
  const listed = useMemo(
    () => new Set(organizations.map((o) => o.organization)),
    [organizations]
  );
  const addable = all.filter((o) => !listed.has(o.slug));

  const save = async (organization: string, draft: SubscriptionDraft) => {
    const result = toSubscriptionRequest(draft);
    if (!result.ok) {
      toast.error(trDynamic(`errors.${result.error}`, dict));
      return false;
    }
    try {
      await saveSubscription(organization, result.value);
      toast.success(tr("subscriptionSaved", dict));
      return true;
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : tr("saveError", dict)
      );
      return false;
    }
  };

  return (
    <section className={SECTION}>
      <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
        {tr("subscriptionsTitle", dict)}
      </h2>
      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
        {tr("subscriptionsDescription", dict, { month })}
      </p>

      {isLoading && <Spinner size="sm" className="mt-3" />}
      {error && (
        <p className="mt-3 text-sm text-red-600 dark:text-red-400">
          {tr("loadError", dict)}
        </p>
      )}

      {!isLoading && !error && (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-700 dark:text-gray-300">
            <thead className="text-xs uppercase text-gray-500 dark:text-gray-400">
              <tr>
                <th className="py-2 pr-3">{tr("colOrganization", dict)}</th>
                <th className="py-2 pr-3">{tr("colQuota", dict)}</th>
                <th className="py-2 pr-3">{tr("colOnExhausted", dict)}</th>
                <th className="py-2 pr-3">{tr("colUsed", dict)}</th>
                <th className="py-2" />
              </tr>
            </thead>
            <tbody>
              {organizations.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-3 text-gray-500">
                    {tr("subscriptionsEmpty", dict)}
                  </td>
                </tr>
              )}
              {organizations.map((o) => (
                <SubscriptionRow
                  key={o.organization}
                  row={o}
                  name={names.get(o.organization) ?? o.organization}
                  onSave={save}
                  dict={dict}
                />
              ))}
            </tbody>
          </table>

          <div className="mt-4 flex flex-wrap items-end gap-2">
            <div className="min-w-60">
              <Label htmlFor="geo-sub-add">{tr("addOrganization", dict)}</Label>
              <Select
                id="geo-sub-add"
                sizing="sm"
                value={adding}
                onChange={(e) => setAdding(e.target.value)}
              >
                <option value="">{tr("pickOrganization", dict)}</option>
                {addable.map((o) => (
                  <option key={o.slug} value={o.slug}>
                    {o.name}
                  </option>
                ))}
              </Select>
            </div>
            <Button
              size="sm"
              color="light"
              disabled={!adding}
              onClick={() =>
                void save(adding, subscriptionDraftFrom(null)).then(
                  (ok) => ok && setAdding("")
                )
              }
            >
              {tr("add", dict)}
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}

function SubscriptionRow({
  row,
  name,
  onSave,
  dict,
}: Readonly<{
  row: OrgGeocodingUsage;
  name: string;
  onSave: (organization: string, draft: SubscriptionDraft) => Promise<boolean>;
  dict: I18nRecord;
}>) {
  const [draft, setDraft] = useState(subscriptionDraftFrom(row.subscription));
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setDraft(subscriptionDraftFrom(row.subscription));
  }, [row.subscription]);

  const quota = row.usage.quota;
  return (
    <tr className="border-t border-gray-100 dark:border-gray-700">
      <td className="py-2 pr-3 font-medium text-gray-900 dark:text-white">
        {name}
        {!row.subscription && (
          <span className="ml-2 text-xs text-amber-600 dark:text-amber-400">
            {tr("noSubscription", dict)}
          </span>
        )}
      </td>
      <td className="py-2 pr-3">
        <TextInput
          sizing="sm"
          inputMode="numeric"
          className="w-28"
          placeholder={tr("planQuota", dict)}
          value={draft.monthlyQuota}
          onChange={(e) => setDraft({ ...draft, monthlyQuota: e.target.value })}
        />
      </td>
      <td className="py-2 pr-3">
        <Select
          sizing="sm"
          value={draft.onExhausted}
          onChange={(e) =>
            setDraft({
              ...draft,
              onExhausted: e.target.value as SubscriptionDraft["onExhausted"],
            })
          }
        >
          <option value="review">{tr("onExhaustedReview", dict)}</option>
          <option value="overage">{tr("onExhaustedOverage", dict)}</option>
        </Select>
      </td>
      <td className="py-2 pr-3 tabular-nums">
        {quota == null ? row.usage.used : `${row.usage.used} / ${quota}`}
      </td>
      <td className="py-2 text-right">
        <Button
          size="xs"
          color="light"
          disabled={isSaving}
          onClick={() => {
            setIsSaving(true);
            void onSave(row.organization, draft).finally(() =>
              setIsSaving(false)
            );
          }}
        >
          {tr("save", dict)}
        </Button>
      </td>
    </tr>
  );
}
