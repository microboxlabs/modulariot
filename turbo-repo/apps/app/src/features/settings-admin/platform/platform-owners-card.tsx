"use client";

import { useState, type ReactNode } from "react";
import { Badge, Button, Spinner, TextInput } from "flowbite-react";
import { HiOutlineKey, HiOutlineLockClosed, HiX } from "react-icons/hi";
import { toast } from "sonner";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr, trDynamic } from "@/features/i18n/tr.service";
import { ApiError } from "../data/json-client";
import { isPlausibleEmail } from "./assignee-email";
import { usePlatformOwnerRole } from "./use-platform-owner-role";

interface PlatformOwnersCardProps {
  readonly dict: I18nRecord;
}

/**
 * The people who may administer the platform.
 *
 * Two sources, shown apart because only one of them is editable here: grants
 * held in the database, and the deployment's `MIOT_PLATFORM_OWNER_EMAILS`,
 * which exists so there is a way back in when the table is empty or wrong.
 */
export default function PlatformOwnersCard({
  dict,
}: Readonly<PlatformOwnersCardProps>) {
  const { role, isLoading, isSaving, error, save } = usePlatformOwnerRole();
  const [draft, setDraft] = useState("");
  const [problemKey, setProblemKey] = useState<string | null>(null);

  const assignees = role?.assigneeIds ?? [];
  const bootstrap = role?.bootstrapAssigneeIds ?? [];
  // The modulith refuses a write that would leave nobody able to make the
  // next one. Mirrored here so the button explains itself instead of 400ing.
  const isLastWayIn = assignees.length === 1 && bootstrap.length === 0;

  /** @returns whether the write landed, so a caller can keep its input. */
  const replace = async (next: string[], successKey: string) => {
    try {
      await save(next);
      toast.success(trDynamic(successKey, dict));
      return true;
    } catch (err) {
      // Only the API's own explanation is shown. Anything else is a bug in
      // this client, and its message would mean nothing to an operator.
      toast.error(
        err instanceof ApiError ? err.message : tr("owners.saveError", dict)
      );
      return false;
    }
  };

  const add = async () => {
    const candidate = draft.trim().toLowerCase();
    if (!isPlausibleEmail(candidate)) {
      setProblemKey("owners.invalidEmail");
      return;
    }
    if (assignees.includes(candidate)) {
      setProblemKey("owners.duplicate");
      return;
    }
    setProblemKey(null);

    const saved = await replace(
      [...assignees, candidate].sort((left, right) => left.localeCompare(right)),
      "owners.added"
    );
    // Cleared only once it is stored: a failed write should leave the address
    // in the field to retry, not make the operator type it again.
    if (saved) setDraft("");
  };

  const handleDraftChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setDraft(event.target.value);
    setProblemKey(null);
  };

  function renderBody(): ReactNode {
    if (isLoading) return <Spinner size="sm" />;
    if (error) {
      return (
        <p className="text-sm text-red-600 dark:text-red-400">
          {tr("owners.loadError", dict)}
        </p>
      );
    }
    return (
      <>
        <ul className="flex flex-col gap-2">
          {bootstrap.map((email) => (
            <li
              key={`bootstrap-${email}`}
              className="flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 dark:border-gray-700 dark:bg-gray-900/40"
            >
              <HiOutlineLockClosed className="h-4 w-4 shrink-0 text-gray-400" />
              <span className="min-w-0 flex-1 truncate text-sm text-gray-900 dark:text-white">
                {email}
              </span>
              <Badge color="gray">{tr("owners.bootstrapBadge", dict)}</Badge>
            </li>
          ))}
          {assignees.map((email) => (
            <li
              key={email}
              className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 dark:border-gray-700"
            >
              <span className="min-w-0 flex-1 truncate text-sm text-gray-900 dark:text-white">
                {email}
              </span>
              <Button
                size="xs"
                color="light"
                disabled={isSaving || isLastWayIn}
                title={isLastWayIn ? tr("owners.lastOwnerHelp", dict) : undefined}
                aria-label={tr("owners.removeLabel", dict, { email })}
                onClick={() =>
                  void replace(
                    assignees.filter((held) => held !== email),
                    "owners.removed"
                  )
                }
              >
                <HiX className="h-3.5 w-3.5" />
              </Button>
            </li>
          ))}
          {assignees.length === 0 && bootstrap.length === 0 && (
            <li className="text-sm text-gray-500 dark:text-gray-400">
              {tr("owners.empty", dict)}
            </li>
          )}
        </ul>

        <div className="mt-3 flex flex-wrap items-start gap-2">
          <div className="min-w-0 flex-1">
            <TextInput
              id="platform-owner-email"
              type="email"
              value={draft}
              disabled={isSaving}
              placeholder={tr("owners.addPlaceholder", dict)}
              aria-label={tr("owners.addLabel", dict)}
              onChange={handleDraftChange}
            />
            {problemKey && (
              <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                {trDynamic(problemKey, dict)}
              </p>
            )}
          </div>
          <Button size="sm" color="blue" disabled={isSaving} onClick={() => void add()}>
            {tr("owners.add", dict)}
          </Button>
        </div>
      </>
    );
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
      <div className="flex items-center gap-2">
        <HiOutlineKey className="h-5 w-5 text-amber-500" />
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
          {tr("title", dict)}
        </h3>
      </div>
      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
        {tr("description", dict)}
      </p>

      <div className="mt-3">{renderBody()}</div>

      <p className="mt-3 text-xs text-gray-400 dark:text-gray-500">
        {tr("owners.bootstrapHelp", dict)}
      </p>
    </div>
  );
}
