"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { Dropdown, DropdownItem } from "flowbite-react";
import {
  HiCheck,
  HiChevronDown,
  HiGlobeAlt,
  HiLink,
  HiLockClosed,
  HiShare,
  HiTrash,
  HiUserPlus,
} from "react-icons/hi2";
import { toast } from "sonner";
import { useClickOutside } from "@/features/common/hooks/use-click-outside";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import type {
  LinkAccess,
  ShareRecipient,
  ShareRole,
  StoryItem,
  StoryShareState,
} from "../storytelling.types";
import {
  avatarTint,
  getShareState,
  initials,
  ORG_DIRECTORY,
  setShareState,
} from "../story-share-store";

interface StorySharePanelProps {
  readonly story: StoryItem;
  readonly lang: string;
  /** `storytelling` dict namespace — same subtree the rest of the page gets. */
  readonly dict: I18nRecord;
}

// Manually prefixed with the "/app" basePath — a plain string, not a
// next/link href, so it doesn't pick up the prefix for free (same reason
// the old StoryShareModal's shareUrl() did this by hand).
function shareUrl(story: StoryItem, lang: string): string {
  if (typeof window === "undefined") return story.title;
  return `${window.location.origin}/app/${lang}/storytelling/${encodeURIComponent(story.id)}`;
}

// Dot-free domain labels joined by explicit dots — no two quantifiers can
// eat the same separator, so matching stays linear (SonarCloud S8786).
const EMAIL_RE = /^[^\s@]+@[^\s.@]+(?:\.[^\s.@]+)+$/;

/** Per-person "Can view / Can edit" picker — flowbite Dropdown, same
 * inline/no-arrow trigger pattern as story-card.tsx's kebab menu. */
function RoleDropdown({
  value,
  label,
  dict,
  onChange,
}: {
  readonly value: ShareRole;
  readonly label: string;
  readonly dict: I18nRecord;
  readonly onChange: (role: ShareRole) => void;
}) {
  const current =
    value === "editor"
      ? tr("share.roleEditor", dict)
      : tr("share.roleViewer", dict);
  return (
    <Dropdown
      inline
      arrowIcon={false}
      label=""
      placement="bottom-end"
      className="w-36 origin-top-right transition-[opacity,transform] duration-150 ease-out starting:scale-95 starting:opacity-0"
      renderTrigger={() => (
        <button
          type="button"
          aria-label={label}
          className="flex shrink-0 items-center gap-1 rounded-md px-1.5 py-1 text-sm text-gray-500 transition-colors hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
        >
          {current}
          <HiChevronDown className="h-3.5 w-3.5" />
        </button>
      )}
    >
      <DropdownItem onClick={() => onChange("viewer")}>
        {tr("share.roleViewer", dict)}
      </DropdownItem>
      <DropdownItem onClick={() => onChange("editor")}>
        {tr("share.roleEditor", dict)}
      </DropdownItem>
    </Dropdown>
  );
}

function Avatar({
  name,
  email,
  className = "",
}: {
  readonly name: string;
  readonly email: string;
  readonly className?: string;
}) {
  return (
    <span
      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-medium ${avatarTint(
        email
      )} ${className}`}
    >
      {initials(name)}
    </span>
  );
}

export default function StorySharePanel({
  story,
  lang,
  dict,
}: StorySharePanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setIsOpen(false), []);
  useClickOutside(containerRef, isOpen, close);

  const [state, setState] = useState<StoryShareState>(() =>
    getShareState(story.id)
  );
  const [query, setQuery] = useState("");
  const [accessMenuOpen, setAccessMenuOpen] = useState(false);
  const accessMenuRef = useRef<HTMLDivElement>(null);
  useClickOutside(accessMenuRef, accessMenuOpen, () =>
    setAccessMenuOpen(false)
  );

  // One place that both persists (localStorage-backed store) and updates the
  // local copy the panel renders from.
  const commit = useCallback(
    (next: StoryShareState) => {
      setShareState(story.id, next);
      setState(next);
    },
    [story.id]
  );

  const takenEmails = useMemo(
    () => new Set(state.people.map((p) => p.email.toLowerCase())),
    [state.people]
  );

  const suggestions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return ORG_DIRECTORY.filter(
      (entry) =>
        !takenEmails.has(entry.email.toLowerCase()) &&
        (entry.name.toLowerCase().includes(q) ||
          entry.email.toLowerCase().includes(q))
    ).slice(0, 5);
  }, [query, takenEmails]);

  const invite = useCallback(
    (person: { id: string; name: string; email: string }) => {
      if (takenEmails.has(person.email.toLowerCase())) return;
      // New invitees land as viewers; the row's own control is where the
      // level gets bumped to editor afterwards.
      const recipient: ShareRecipient = { ...person, role: "viewer" };
      commit({ ...state, people: [...state.people, recipient] });
      setQuery("");
      toast.success(tr("share.invited", dict, { name: person.name }));
    },
    [commit, dict, state, takenEmails]
  );

  const inviteTyped = useCallback(() => {
    const email = query.trim();
    if (!EMAIL_RE.test(email)) return;
    const match = ORG_DIRECTORY.find(
      (e) => e.email.toLowerCase() === email.toLowerCase()
    );
    invite(match ?? { id: `ext-${email.toLowerCase()}`, name: email, email });
  }, [invite, query]);

  const updateRole = useCallback(
    (id: string, role: ShareRole) => {
      commit({
        ...state,
        people: state.people.map((p) => (p.id === id ? { ...p, role } : p)),
      });
    },
    [commit, state]
  );

  const removePerson = useCallback(
    (person: ShareRecipient) => {
      commit({
        ...state,
        people: state.people.filter((p) => p.id !== person.id),
      });
      toast.success(tr("share.accessRemoved", dict, { name: person.name }));
    },
    [commit, dict, state]
  );

  const setLinkAccess = useCallback(
    (linkAccess: LinkAccess) => commit({ ...state, linkAccess }),
    [commit, state]
  );

  const handleCopyLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(shareUrl(story, lang));
      toast.success(tr("share.copied", dict));
    } catch {
      toast.error(tr("share.copyFailed", dict));
    }
  }, [dict, lang, story]);

  const canInviteTyped = EMAIL_RE.test(query.trim());
  const linkRestricted = state.linkAccess === "restricted";

  let generalAccessHint = tr("share.linkRestrictedHint", dict);
  if (state.linkAccess === "viewer")
    generalAccessHint = tr("share.linkViewerHint", dict);
  else if (state.linkAccess === "editor")
    generalAccessHint = tr("share.linkEditorHint", dict);

  const currentAccessLabel = linkRestricted
    ? tr("share.linkRestricted", dict)
    : tr("share.linkAnyone", dict);

  const accessOptions: readonly { value: LinkAccess; label: string }[] = [
    { value: "restricted", label: tr("share.linkRestricted", dict) },
    {
      value: "viewer",
      label: `${tr("share.linkAnyone", dict)} · ${tr("share.roleViewer", dict)}`,
    },
    {
      value: "editor",
      label: `${tr("share.linkAnyone", dict)} · ${tr("share.roleEditor", dict)}`,
    },
  ];

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
        <div className="animate-story-enter absolute right-0 top-full z-50 mt-2 w-120 max-w-[calc(100vw-2rem)] rounded-xl border border-gray-200 bg-white shadow-xl dark:border-gray-700 dark:bg-gray-900">
          <div className="px-5 pt-4 pb-3">
            <h3 className="text-base font-medium text-gray-900 dark:text-white">
              {tr("share.title", dict)}
            </h3>
          </div>

          <div className="px-5">
            {/* Invite people — its own titled block. */}
            <p className="mb-2 text-xs font-medium text-gray-500 dark:text-gray-400">
              {tr("share.inviteTitle", dict)}
            </p>
            <div className="relative">
              <div className="flex items-center gap-2">
                <div className="flex flex-1 items-center gap-1.5 rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-1.5 focus-within:border-blue-500 dark:border-gray-700 dark:bg-gray-800">
                  <HiUserPlus className="h-4 w-4 shrink-0 text-gray-400 dark:text-gray-500" />
                  <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && canInviteTyped) {
                        e.preventDefault();
                        inviteTyped();
                      }
                    }}
                    placeholder={tr("share.invitePlaceholder", dict)}
                    className="w-full min-w-0 bg-transparent text-sm text-gray-900 placeholder-gray-400 outline-none dark:text-white dark:placeholder-gray-500"
                  />
                </div>
                <button
                  type="button"
                  onClick={inviteTyped}
                  disabled={!canInviteTyped}
                  className="shrink-0 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {tr("share.inviteButton", dict)}
                </button>
              </div>

              {suggestions.length > 0 && (
                <ul className="absolute inset-x-0 top-full z-10 mt-1 overflow-hidden rounded-lg border border-gray-200 bg-white py-1 shadow-lg dark:border-gray-700 dark:bg-gray-800">
                  {suggestions.map((entry) => (
                    <li key={entry.id}>
                      <button
                        type="button"
                        onClick={() => invite(entry)}
                        className="flex w-full items-center gap-3 px-3 py-2 text-left transition-colors hover:bg-gray-50 dark:hover:bg-gray-700/60"
                      >
                        <Avatar name={entry.name} email={entry.email} />
                        <span className="min-w-0">
                          <span className="block truncate text-sm text-gray-900 dark:text-white">
                            {entry.name}
                          </span>
                          <span className="block truncate text-xs text-gray-400 dark:text-gray-500">
                            {entry.email}
                          </span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* People with access — its own titled block. */}
            <p className="mt-5 mb-1 text-xs font-medium text-gray-500 dark:text-gray-400">
              {tr("share.peopleWithAccess", dict)}
            </p>
            <ul className="flex flex-col">
              <li className="flex items-center gap-3 py-2">
                <Avatar name={tr("share.owner", dict)} email="owner@you" />
                <span className="min-w-0 flex-1 truncate text-sm text-gray-900 dark:text-white">
                  {tr("share.owner", dict)}
                </span>
                <span className="shrink-0 text-sm text-gray-400 dark:text-gray-500">
                  {tr("share.ownerBadge", dict)}
                </span>
              </li>

              {state.people.map((person) => (
                <li key={person.id} className="flex items-center gap-3 py-2">
                  <Avatar name={person.name} email={person.email} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-gray-900 dark:text-white">
                      {person.name}
                    </span>
                    <span className="block truncate text-xs text-gray-400 dark:text-gray-500">
                      {person.email}
                    </span>
                  </span>
                  <RoleDropdown
                    value={person.role}
                    label={tr("share.roleForLabel", dict, {
                      name: person.name,
                    })}
                    dict={dict}
                    onChange={(role) => updateRole(person.id, role)}
                  />
                  <button
                    type="button"
                    onClick={() => removePerson(person)}
                    aria-label={tr("share.removeFor", dict, {
                      name: person.name,
                    })}
                    title={tr("share.remove", dict)}
                    className="shrink-0 rounded-md p-1.5 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600 dark:text-gray-500 dark:hover:bg-red-900/20 dark:hover:text-red-400"
                  >
                    <HiTrash className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {/* Full-bleed rule splitting invited people from link-level access. */}
          <div className="mt-3 border-t border-gray-200 dark:border-gray-700" />

          {/* General access — one control: a full-width button showing the
              current setting with a chevron, opening a small menu. */}
          <div ref={accessMenuRef} className="relative">
            <button
              type="button"
              onClick={() => setAccessMenuOpen((prev) => !prev)}
              aria-label={tr("share.generalAccess", dict)}
              aria-expanded={accessMenuOpen}
              className="flex w-full items-center gap-3 px-5 py-2.5 text-left transition-colors hover:bg-gray-50 dark:hover:bg-gray-800"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400">
                {linkRestricted ? (
                  <HiLockClosed className="h-4 w-4" />
                ) : (
                  <HiGlobeAlt className="h-4 w-4" />
                )}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium text-gray-900 dark:text-white">
                  {currentAccessLabel}
                </span>
                <span className="block truncate text-xs text-gray-400 dark:text-gray-500">
                  {generalAccessHint}
                </span>
              </span>
              <HiChevronDown
                className={`h-4 w-4 shrink-0 text-gray-400 transition-transform ${
                  accessMenuOpen ? "rotate-180" : ""
                }`}
              />
            </button>

            {accessMenuOpen && (
              <ul className="absolute inset-x-3 top-full z-10 mt-1 overflow-hidden rounded-lg border border-gray-200 bg-white py-1 shadow-lg dark:border-gray-700 dark:bg-gray-800">
                {accessOptions.map((opt) => (
                  <li key={opt.value}>
                    <button
                      type="button"
                      onClick={() => {
                        setLinkAccess(opt.value);
                        setAccessMenuOpen(false);
                      }}
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-gray-900 transition-colors hover:bg-gray-50 dark:text-white dark:hover:bg-gray-700/60"
                    >
                      <HiCheck
                        className={`h-4 w-4 shrink-0 ${
                          state.linkAccess === opt.value
                            ? "text-blue-600 dark:text-blue-400"
                            : "text-transparent"
                        }`}
                      />
                      <span className="truncate">{opt.label}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="border-t border-gray-200 dark:border-gray-700" />

          <button
            type="button"
            onClick={handleCopyLink}
            className="flex w-full items-center justify-center gap-2 rounded-b-xl py-3 text-sm font-medium text-blue-600 transition-colors hover:bg-gray-50 dark:text-blue-400 dark:hover:bg-gray-800"
          >
            <HiLink className="h-4 w-4" />
            {tr("share.copyLink", dict)}
          </button>
        </div>
      )}
    </div>
  );
}
