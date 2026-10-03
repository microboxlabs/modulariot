"use client";

import { useEffect, useState } from "react";
import {
  Button,
  Label,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  TextInput,
} from "flowbite-react";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr, trDynamic } from "@/features/i18n/tr.service";
import { ControlTowerError } from "../control-tower/control-tower-api";
import {
  publishDraft,
  publishPlan,
  type PublishPlan,
  type VersionBump,
} from "./maintainer-api";
import { BumpBadge } from "./ui/badges";

const BUMPS: VersionBump[] = ["PATCH", "MINOR", "MAJOR"];

const BUMP_LABEL: Record<VersionBump, string> = {
  MAJOR: "bumpMajor",
  MINOR: "bumpMinor",
  PATCH: "bumpPatch",
};

const BUMP_WHY: Record<VersionBump, string> = {
  MAJOR: "bumpWhyMajor",
  MINOR: "bumpWhyMinor",
  PATCH: "bumpWhyPatch",
};

/** The version a bump makes from the one in force: 2.1.0 + MINOR = 2.2.0. */
export function nextVersion(current: string, bump: VersionBump): string {
  const [major = 0, minor = 0, patch = 0] = current.split(".").map(Number);
  if (bump === "MAJOR") return `${major + 1}.0.0`;
  if (bump === "MINOR") return `${major}.${minor + 1}.0`;
  return `${major}.${minor}.${patch + 1}`;
}

/** Why publishing failed, in the page's language. */
export function publishError(e: unknown, d: I18nRecord): string {
  const status = e instanceof ControlTowerError ? e.status : null;
  if (status === 409) return tr("publishConflict", d);
  if (status === 403) return tr("ownersOnlyChange", d);
  return tr("actionFailed", d);
}

/** Publishing the draft, as in the prototype: from → to with the bump and why, the changes, a reason. */
export default function PublishDialog({
  id,
  name,
  current,
  open,
  d,
  onClose,
  onPublished,
}: Readonly<{
  id: string;
  name: string;
  current: string | null;
  open: boolean;
  d: I18nRecord;
  onClose: () => void;
  onPublished: () => void;
}>) {
  const [plan, setPlan] = useState<PublishPlan | null>(null);
  const [reason, setReason] = useState("");
  const [raise, setRaise] = useState<VersionBump | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setPlan(null);
    setError(null);
    setReason("");
    setRaise(null);
    publishPlan(id)
      .then(setPlan)
      .catch((e: unknown) => setError(publishError(e, d)));
  }, [open, id, d]);

  const bump = raise ?? plan?.bump ?? null;
  const target =
    raise && current ? nextVersion(current, raise) : (plan?.nextVersion ?? "");
  // A first version is always 0.1.0, so there is nothing to raise.
  const higher =
    plan?.bump && current ? BUMPS.slice(BUMPS.indexOf(plan.bump) + 1) : [];
  const errors = (plan?.report.findings ?? []).filter(
    (f) => f.severity === "ERROR"
  ).length;

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await publishDraft(id, { reason: reason.trim(), bump });
      onPublished();
    } catch (e) {
      setError(publishError(e, d));
    } finally {
      setBusy(false);
    }
  };

  const blocked = !plan?.report.publishable || !plan?.bump;

  return (
    <Modal show={open} size="xl" onClose={onClose}>
      <ModalHeader>
        <span className="block">{tr("publishOf", d, { name })}</span>
        {plan?.bump && bump && (
          <span className="mt-1 flex flex-wrap items-center gap-2 text-sm font-normal">
            <span className="font-mono text-gray-500">
              {current ?? tr("unpublishedShort", d)}
            </span>
            <span aria-hidden>→</span>
            <span className="font-mono font-semibold">{target}</span>
            <BumpBadge bump={bump} d={d} />
            <span className="text-xs text-gray-500">
              {trDynamic(BUMP_WHY[bump], d)}
            </span>
          </span>
        )}
      </ModalHeader>
      <ModalBody>
        {plan && (
          <div className="flex flex-col gap-4">
            {plan.bump ? (
              <ul className="flex flex-col gap-2 text-sm text-gray-700 dark:text-gray-300">
                {plan.changes.map((c) => (
                  <li
                    key={`${c.section}-${c.text}`}
                    className="flex items-start gap-2"
                  >
                    <BumpBadge bump={c.bump} d={d} className="mt-0.5" />
                    <span>{c.text}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-gray-600">{tr("nothingChanged", d)}</p>
            )}
            {higher.length > 0 && (
              <label className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300">
                <span>{tr("raiseTo", d)}</span>
                <select
                  className="rounded-md border border-gray-300 bg-white px-2 py-1 text-xs dark:border-gray-600 dark:bg-gray-900"
                  value={raise ?? ""}
                  onChange={(e) =>
                    setRaise((e.target.value || null) as VersionBump | null)
                  }
                >
                  <option value="">{tr("raiseAuto", d)}</option>
                  {higher.map((b) => (
                    <option key={b} value={b}>
                      {trDynamic(BUMP_LABEL[b], d)}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {errors > 0 && (
              <p
                role="alert"
                className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-900/50 dark:bg-red-900/20 dark:text-red-300"
              >
                {tr("errorsBlockPublish", d, { count: String(errors) })}
              </p>
            )}
            <div>
              <Label htmlFor="publish-reason">
                {tr("reasonForHistory", d)}
              </Label>
              <TextInput
                id="publish-reason"
                value={reason}
                maxLength={500}
                onChange={(e) => setReason(e.target.value)}
                placeholder={tr("reasonPlaceholder", d)}
              />
            </div>
            <p className="text-[11px] text-gray-500">{tr("versionsNote", d)}</p>
          </div>
        )}
        {error && (
          <p className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>
        )}
      </ModalBody>
      <ModalFooter className="justify-end">
        <Button color="alternative" onClick={onClose}>
          {tr("cancel", d)}
        </Button>
        <Button
          disabled={busy || blocked || !reason.trim()}
          onClick={() => void submit()}
        >
          {target
            ? tr("publishVersion", d, { version: target })
            : tr("publish", d)}
        </Button>
      </ModalFooter>
    </Modal>
  );
}
