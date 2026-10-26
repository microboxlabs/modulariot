"use client";

import { useEffect, useState } from "react";
import useSWR, { mutate } from "swr";
import { Button, Label, Select } from "flowbite-react";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr, trDynamic } from "@/features/i18n/tr.service";
import { useTeams } from "@/features/settings-admin/team/team-api";
import { MILESTONES, monitorKey, tripsRequest } from "./monitors-api";

type Confirmers = Partial<Record<(typeof MILESTONES)[number], string>>;

const confirmersKey = (key: string) => `${monitorKey(key)}/confirmers`;

export function useConfirmers(key: string) {
  return useSWR<Confirmers>(confirmersKey(key), (url: string) =>
    tripsRequest<Confirmers>(url)
  );
}

/**
 * The team that confirms each milestone of the monitor's trips. Saved apart from the draft: it applies to open trips
 * at once. "Anyone" leaves the milestone to the confirm permission.
 */
export function ConfirmersPanel({
  monitor,
  canEdit,
  d,
}: Readonly<{ monitor: string; canEdit: boolean; d: I18nRecord }>) {
  const { data: saved } = useConfirmers(monitor);
  const { data: teams } = useTeams(canEdit);
  const [value, setValue] = useState<Confirmers>({});
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (saved) setValue(saved);
  }, [saved]);

  const dirty = JSON.stringify(value) !== JSON.stringify(saved ?? {});
  const teamName = (id: string | undefined) =>
    teams?.find((t) => t.id === id)?.name ?? tr("confirmers.assigned", d);

  const save = async () => {
    setBusy(true);
    setMessage(null);
    try {
      await tripsRequest(confirmersKey(monitor), {
        method: "PUT",
        body: value,
      });
      await mutate(confirmersKey(monitor));
      setMessage(tr("confirmers.saved", d));
    } catch (e) {
      setMessage(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const pick = (milestone: string, team: string) =>
    setValue((current) => {
      const next = { ...current } as Record<string, string>;
      if (team) next[milestone] = team;
      else delete next[milestone];
      return next as Confirmers;
    });

  return (
    <div className="flex flex-col gap-3">
      <div className="grid gap-3 sm:grid-cols-3">
        {MILESTONES.map((m) => (
          <div key={m} className="flex flex-col gap-1">
            <Label htmlFor={`confirmer-${m}`}>
              {trDynamic(`milestones.${m}`, d)}
            </Label>
            {canEdit ? (
              <Select
                id={`confirmer-${m}`}
                sizing="sm"
                value={value[m] ?? ""}
                disabled={busy}
                onChange={(e) => pick(m, e.target.value)}
              >
                <option value="">{tr("confirmers.anyone", d)}</option>
                {(teams ?? []).map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </Select>
            ) : (
              <span className="text-sm text-gray-700 dark:text-gray-300">
                {value[m] ? teamName(value[m]) : tr("confirmers.anyone", d)}
              </span>
            )}
          </div>
        ))}
      </div>
      {canEdit && (
        <div className="flex items-center gap-3">
          <Button
            size="sm"
            color="blue"
            disabled={busy || !dirty}
            onClick={save}
          >
            {tr("confirmers.save", d)}
          </Button>
          {message && (
            <span className="text-sm text-gray-600 dark:text-gray-300">
              {message}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
