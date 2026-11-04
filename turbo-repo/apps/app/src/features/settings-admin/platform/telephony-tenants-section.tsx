"use client";

import { useState } from "react";
import {
  Button,
  Label,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  Spinner,
  Select,
  TextInput,
} from "flowbite-react";
import { toast } from "sonner";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import {
  currentMonth,
  parseMonthlyMinutes,
  usd,
  type OrgTelephonyUsage,
} from "@/features/telephony/telephony-plan";
import { usePlatformOrganizations } from "./use-platform-organizations";
import { useTelephonyTenants } from "./use-telephony-plan";

const SECTION =
  "rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800";

/**
 * Every organization on the managed line this month: minutes against its
 * quota, calls Telnyx has not confirmed, what the plan charges and what Telnyx
 * charged the platform. The minutes of one organization are set in a modal.
 */
export default function TelephonyTenantsSection({
  dict,
}: Readonly<{ dict: I18nRecord }>) {
  const [month, setMonth] = useState(() => currentMonth());
  const { organizations, isLoading, error, saveMinutes } =
    useTelephonyTenants(month);
  const { organizations: allOrganizations } = usePlatformOrganizations(true);
  const [selectedTenant, setSelectedTenant] = useState("");
  const [editing, setEditing] = useState<{
    tenantCode: string;
    subscription: OrgTelephonyUsage["subscription"];
  } | null>(null);

  return (
    <section className={SECTION}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">
            {tr("title", dict)}
          </h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {tr("description", dict)}
          </p>
        </div>
        <TextInput
          type="month"
          aria-label={tr("month", dict)}
          value={month}
          onChange={(e) => e.target.value && setMonth(e.target.value)}
        />
      </div>
      <div className="mt-4 flex gap-2">
        <Select
          aria-label={tr("organization", dict)}
          value={selectedTenant}
          onChange={(e) => setSelectedTenant(e.target.value)}
        >
          <option value="">{tr("selectOrganization", dict)}</option>
          {allOrganizations.map((org) => (
            <option key={org.slug} value={org.slug}>
              {org.name || org.slug}
            </option>
          ))}
        </Select>
        <Button
          disabled={!selectedTenant}
          onClick={() =>
            setEditing(
              organizations.find(
                (org) => org.tenantCode === selectedTenant
              ) ?? { tenantCode: selectedTenant, subscription: null }
            )
          }
        >
          {tr("editMinutes", dict)}
        </Button>
      </div>
      {isLoading && <Spinner size="md" />}
      {error && (
        <p className="mt-3 text-sm text-red-600">{tr("loadFailed", dict)}</p>
      )}
      {!isLoading && !error && organizations.length === 0 && (
        <p className="mt-3 text-sm text-gray-500">{tr("empty", dict)}</p>
      )}
      {organizations.length > 0 && (
        <table className="mt-4 w-full text-left text-sm">
          <thead className="text-xs uppercase text-gray-500 dark:text-gray-400">
            <tr>
              <th className="py-2">{tr("organization", dict)}</th>
              <th>{tr("minutes", dict)}</th>
              <th>{tr("pending", dict)}</th>
              <th>{tr("charge", dict)}</th>
              <th>{tr("providerCost", dict)}</th>
              <th />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {organizations.map((o) => (
              <tr key={o.tenantCode}>
                <td className="py-2 font-medium text-gray-900 dark:text-white">
                  {o.tenantCode}
                </td>
                <td>
                  {o.usage.usedMinutes} / {o.usage.quotaMinutes}
                </td>
                <td>{o.usage.pending}</td>
                <td>{usd(o.usage.chargeUsd)}</td>
                <td>{usd(o.usage.providerCost)}</td>
                <td className="text-right">
                  <Button size="xs" color="light" onClick={() => setEditing(o)}>
                    {tr("editMinutes", dict)}
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {editing && (
        <MinutesModal
          org={editing}
          dict={dict}
          onClose={() => setEditing(null)}
          onSave={async (minutes) => {
            await saveMinutes(editing.tenantCode, minutes);
            toast.success(tr("saved", dict));
            setEditing(null);
          }}
        />
      )}
    </section>
  );
}

function MinutesModal({
  org,
  dict,
  onClose,
  onSave,
}: Readonly<{
  org: { tenantCode: string; subscription: OrgTelephonyUsage["subscription"] };
  dict: I18nRecord;
  onClose: () => void;
  onSave: (minutes: number | null) => Promise<void>;
}>) {
  const [value, setValue] = useState(
    org.subscription?.monthlyMinutes == null
      ? ""
      : String(org.subscription.monthlyMinutes)
  );
  const [busy, setBusy] = useState(false);
  const parsed = parseMonthlyMinutes(value);
  return (
    <Modal show size="md" onClose={onClose} dismissible>
      <ModalHeader>
        {tr("editMinutes", dict)} · {org.tenantCode}
      </ModalHeader>
      <ModalBody>
        <Label htmlFor="telephony-org-minutes">
          {tr("monthlyMinutes", dict)}
        </Label>
        <TextInput
          id="telephony-org-minutes"
          inputMode="numeric"
          value={value}
          color={parsed.ok ? undefined : "failure"}
          onChange={(e) => setValue(e.target.value)}
        />
        <p className="mt-1 text-xs text-gray-500">
          {tr("monthlyMinutesHelp", dict)}
        </p>
      </ModalBody>
      <ModalFooter className="justify-end">
        <Button color="alternative" onClick={onClose}>
          {tr("cancel", dict)}
        </Button>
        <Button
          disabled={busy || !parsed.ok}
          onClick={async () => {
            if (!parsed.ok) return;
            setBusy(true);
            try {
              await onSave(parsed.value);
            } catch {
              toast.error(tr("saveFailed", dict));
            } finally {
              setBusy(false);
            }
          }}
        >
          {tr("save", dict)}
        </Button>
      </ModalFooter>
    </Modal>
  );
}
