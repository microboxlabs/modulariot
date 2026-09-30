"use client";

import { useEffect, useState } from "react";
import {
  Button,
  Label,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  Select,
  TextInput,
} from "flowbite-react";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import {
  publishDraft,
  publishPlan,
  type PublishPlan,
  type SymptomState,
  type VersionBump,
} from "./maintainer-api";

const BUMPS: VersionBump[] = ["PATCH", "MINOR", "MAJOR"];

/** Publishing the draft: what changed, the version it becomes, a reason and the state to publish in. */
export default function PublishDialog({
  id,
  open,
  d,
  onClose,
  onPublished,
}: Readonly<{
  id: string;
  open: boolean;
  d: I18nRecord;
  onClose: () => void;
  onPublished: () => void;
}>) {
  const [plan, setPlan] = useState<PublishPlan | null>(null);
  const [reason, setReason] = useState("");
  const [state, setState] = useState<SymptomState>("TEST");
  const [bump, setBump] = useState<VersionBump | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setReason("");
    publishPlan(id)
      .then((p) => {
        setPlan(p);
        setBump(p.bump);
        if (p.report.needsTestOnly) setState("TEST");
      })
      .catch((e: unknown) =>
        setError(e instanceof Error ? e.message : String(e))
      );
  }, [open, id]);

  const allowed = plan?.bump ? BUMPS.slice(BUMPS.indexOf(plan.bump)) : [];

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await publishDraft(id, { reason: reason.trim(), bump, state });
      onPublished();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const blocked = !plan?.report.publishable || !plan?.bump;

  return (
    <Modal show={open} size="lg" onClose={onClose}>
      <ModalHeader>{tr("publishTitle", d)}</ModalHeader>
      <ModalBody>
        {plan && (
          <div className="flex flex-col gap-4">
            {plan.bump ? (
              <div>
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  {tr("publishBecomes", d, { version: plan.nextVersion ?? "" })}
                </p>
                <ul className="mt-2 list-disc pl-5 text-sm text-gray-700 dark:text-gray-300">
                  {plan.changes.map((c) => (
                    <li key={`${c.section}-${c.text}`}>
                      {c.text}{" "}
                      <span className="text-xs text-gray-500">({c.bump})</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="text-sm text-gray-600">{tr("nothingChanged", d)}</p>
            )}
            {!plan.report.publishable && (
              <p className="text-sm text-red-600 dark:text-red-400">
                {tr("fixErrorsFirst", d)}
              </p>
            )}
            <div>
              <Label htmlFor="publish-reason">{tr("reason", d)}</Label>
              <TextInput
                id="publish-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder={tr("reasonPlaceholder", d)}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="publish-bump">{tr("versionBump", d)}</Label>
                <Select
                  id="publish-bump"
                  value={bump ?? ""}
                  onChange={(e) => setBump(e.target.value as VersionBump)}
                  disabled={allowed.length < 2}
                >
                  {allowed.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label htmlFor="publish-state">{tr("publishAs", d)}</Label>
                <Select
                  id="publish-state"
                  value={state}
                  onChange={(e) => setState(e.target.value as SymptomState)}
                >
                  <option value="TEST">{tr("stateTest", d)}</option>
                  <option value="ACTIVE" disabled={plan.report.needsTestOnly}>
                    {tr("stateActive", d)}
                  </option>
                </Select>
              </div>
            </div>
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
          {tr("publish", d)}
        </Button>
      </ModalFooter>
    </Modal>
  );
}
