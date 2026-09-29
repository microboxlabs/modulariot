"use client";

import { useRef, useState, type ReactNode } from "react";
import { HiShare, HiTrash, HiUserPlus } from "react-icons/hi2";
import { toast } from "sonner";
import { useClickOutside } from "@/features/common/hooks/use-click-outside";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import { revokeStoryShare, shareStory } from "../stories-api";
import type { ShareEntry, SharePermission, Story } from "../storytelling.types";

interface StorySharePanelProps {
  readonly story: Story;
  readonly dict: I18nRecord;
  /** Called with the new share list after every change. */
  readonly onSharesChange: (shares: readonly ShareEntry[]) => void;
  /** Extra rows above the people list, e.g. a link to copy. */
  readonly children?: ReactNode;
}

// Dot-free domain labels joined by explicit dots — no two quantifiers can
// eat the same separator, so matching stays linear (SonarCloud S8786).
const EMAIL_RE = /^[^\s@]+@[^\s.@]+(?:\.[^\s.@]+)+$/;

const SELECT_CLASS =
  "rounded-lg border border-gray-200 bg-white py-1 pr-7 pl-2 text-xs text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200";

function PermissionSelect({
  value,
  label,
  dict,
  onChange,
}: {
  readonly value: SharePermission;
  readonly label: string;
  readonly dict: I18nRecord;
  readonly onChange: (permission: SharePermission) => void;
}) {
  return (
    <select
      value={value}
      aria-label={label}
      onChange={(e) => onChange(e.target.value as SharePermission)}
      className={SELECT_CLASS}
    >
      <option value="read">{tr("share.roleViewer", dict)}</option>
      <option value="write">{tr("share.roleEditor", dict)}</option>
    </select>
  );
}

/** Who can open a story the caller owns, and at which permission. */
export default function StorySharePanel({
  story,
  dict,
  onSharesChange,
  children,
}: StorySharePanelProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [principal, setPrincipal] = useState("");
  const [permission, setPermission] = useState<SharePermission>("read");
  const [busy, setBusy] = useState(false);
  useClickOutside(containerRef, isOpen, () => setIsOpen(false));

  const shares = story.sharedWith ?? [];
  const canInvite = EMAIL_RE.test(principal.trim()) && !busy;

  async function grant(who: string, level: SharePermission) {
    setBusy(true);
    try {
      const saved = await shareStory(story.id, who, level);
      onSharesChange([
        ...shares.filter((s) => s.principal !== saved.principal),
        saved,
      ]);
      return true;
    } catch {
      toast.error(tr("share.failed", dict));
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function invite() {
    const who = principal.trim();
    if (!EMAIL_RE.test(who)) return;
    if (await grant(who, permission)) {
      setPrincipal("");
      toast.success(tr("share.invited", dict, { name: who }));
    }
  }

  async function revoke(who: string) {
    try {
      await revokeStoryShare(story.id, who);
      onSharesChange(shares.filter((s) => s.principal !== who));
      toast.success(tr("share.accessRemoved", dict, { name: who }));
    } catch {
      toast.error(tr("share.failed", dict));
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        title={tr("menu.share", dict)}
        aria-label={tr("menu.share", dict)}
        aria-expanded={isOpen}
        className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${
          isOpen
            ? "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200"
            : "text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-200"
        }`}
      >
        <HiShare className="h-4 w-4" />
      </button>

      {isOpen && (
        <div className="animate-story-enter absolute right-0 top-full z-50 mt-2 w-96 max-w-[calc(100vw-2rem)] rounded-xl border border-gray-200 bg-white p-4 shadow-xl dark:border-gray-700 dark:bg-gray-900">
          <h3 className="mb-3 text-base font-medium text-gray-900 dark:text-white">
            {tr("share.title", dict)}
          </h3>

          {children}

          <p className="mb-2 text-xs font-medium text-gray-500 dark:text-gray-400">
            {tr("share.inviteTitle", dict)}
          </p>
          <div className="flex items-center gap-2">
            <div className="flex min-w-0 flex-1 items-center gap-1.5 rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-1.5 focus-within:border-blue-500 dark:border-gray-700 dark:bg-gray-800">
              <HiUserPlus className="h-4 w-4 shrink-0 text-gray-400 dark:text-gray-500" />
              <input
                type="email"
                value={principal}
                onChange={(e) => setPrincipal(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && canInvite) {
                    e.preventDefault();
                    void invite();
                  }
                }}
                placeholder={tr("share.invitePlaceholder", dict)}
                aria-label={tr("share.invitePlaceholder", dict)}
                className="w-full min-w-0 bg-transparent text-sm text-gray-900 placeholder-gray-400 outline-none dark:text-white dark:placeholder-gray-500"
              />
            </div>
            <PermissionSelect
              value={permission}
              label={tr("share.permissionLabel", dict)}
              dict={dict}
              onChange={setPermission}
            />
            <button
              type="button"
              onClick={() => void invite()}
              disabled={!canInvite}
              className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {tr("share.inviteButton", dict)}
            </button>
          </div>

          <p className="mt-4 mb-2 text-xs font-medium text-gray-500 dark:text-gray-400">
            {tr("share.peopleWithAccess", dict)}
          </p>
          {shares.length === 0 ? (
            <p className="text-xs text-gray-400 dark:text-gray-500">
              {tr("share.onlyYou", dict)}
            </p>
          ) : (
            <ul className="flex max-h-56 flex-col gap-1 overflow-y-auto">
              {shares.map((share) => (
                <li key={share.principal} className="flex items-center gap-2">
                  <span className="min-w-0 flex-1 truncate text-sm text-gray-700 dark:text-gray-200">
                    {share.principal}
                  </span>
                  <PermissionSelect
                    value={share.permission}
                    label={tr("share.roleForLabel", dict, {
                      name: share.principal,
                    })}
                    dict={dict}
                    onChange={(level) => void grant(share.principal, level)}
                  />
                  <button
                    type="button"
                    onClick={() => void revoke(share.principal)}
                    aria-label={tr("share.removeFor", dict, {
                      name: share.principal,
                    })}
                    title={tr("share.remove", dict)}
                    className="flex h-7 w-7 items-center justify-center rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20 dark:hover:text-red-400"
                  >
                    <HiTrash className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
