"use client";

/**
 * Who may use the dashboard, with the app's shared search box: the same
 * `PlanningSearchAutocomplete` the calendar planning, the places catalog and
 * the move-to-task dialog use, in its list mode: while you type it lists
 * every member and team that matches under its header ("Miembros (2)",
 * "Equipos (1)"); picking one gives it access, then its role is chosen.
 */
import { useCallback, useMemo, useState, type ReactNode } from "react";
import {
  HiOutlineTrash,
  HiOutlineUser,
  HiOutlineUserGroup,
} from "react-icons/hi";
import {
  PlanningSearchAutocomplete,
  type SearchAutocompleteField,
} from "@microboxlabs/miot-calendar-ui";
import type { PermissionAssignment } from "@microboxlabs/miot-dashboard-ui/react";
import { HiOutlineGlobeAlt, HiOutlineLockClosed } from "react-icons/hi2";
import { SegmentedControl } from "@/features/common/components/segmented-control";
import { RolePicker } from "./role-picker";
import type { Visibility } from "./setup.types";
import {
  TEAM_AUTHORITY_PREFIX,
  type Principal,
  type PrincipalKind,
} from "./use-principal-directory";

type T = (key: string, params?: Record<string, string>) => string;

/** A principal as the shared search box reads items: with an `id`. */
type SearchItem = Principal & { id: string };

/** The shared box asks for the planning panel's texts; these are ours. */
const SEARCH_TEXTS: Record<string, string> = {
  "pages.planning.sidebar.searchPlaceholder": "search",
  "pages.planning.sidebar.search.minCharacters": "minCharacters",
  "pages.planning.sidebar.search.loading": "loading",
  "pages.planning.sidebar.search.noResults": "noResults",
  "pages.planning.sidebar.search.noResultsFor": "noResultsFor",
};

const ICON = "h-4 w-4 text-gray-600 dark:text-gray-400";

/** How many members and teams a click on the empty search shows of each. */
const SHOWN_BEFORE_TYPING = 5;

/** Domain names are case insensitive; preserve the mailbox's spelling. */
function canonicalEmail(value: string) {
  const email = value.trim();
  const at = email.lastIndexOf("@");
  return at < 0
    ? email
    : email.slice(0, at + 1) + email.slice(at + 1).toLowerCase();
}

function principalKey(authorityId: string) {
  return authorityId.startsWith(TEAM_AUTHORITY_PREFIX)
    ? authorityId
    : canonicalEmail(authorityId);
}

/** Sharing still works when organization directory access is unavailable. */
function EmailPermissionForm({
  taken,
  onAdd,
  t,
}: Readonly<{
  taken: ReadonlySet<string>;
  onAdd: (email: string) => void;
  t: T;
}>) {
  const [email, setEmail] = useState("");
  const trimmed = canonicalEmail(email);
  const existing = new Set([...taken].map(canonicalEmail));
  return (
    <form
      className="flex gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        if (!trimmed || existing.has(trimmed)) return;
        onAdd(trimmed);
        setEmail("");
      }}
    >
      <input
        type="email"
        required
        aria-label={t("email")}
        placeholder={t("email")}
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        className="min-w-0 flex-1 rounded-lg border border-gray-300 bg-white text-sm dark:border-gray-600 dark:bg-gray-700"
      />
      <button
        type="submit"
        disabled={!trimmed || existing.has(trimmed)}
        className="rounded-lg bg-blue-600 px-3 py-2 text-sm text-white disabled:opacity-50"
      >
        {t("addEmail")}
      </button>
    </form>
  );
}

/** What a kind of principal is searched by. */
function searchText(principal: Principal, kind: PrincipalKind) {
  if (principal.kind !== kind) return undefined;
  return [principal.name, principal.detail].filter(Boolean).join(" ");
}

/** An empty list, drawn like the tags step's empty tag box. */
function EmptyBox({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <div className="flex min-h-9 items-center rounded-lg border border-dashed border-gray-300 px-2 py-1.5 dark:border-gray-600">
      <span className="px-1 text-xs text-gray-400 dark:text-gray-500">
        {children}
      </span>
    </div>
  );
}

function PrincipalIcon({ kind }: Readonly<{ kind: PrincipalKind }>) {
  const Icon = kind === "team" ? HiOutlineUserGroup : HiOutlineUser;
  return (
    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-300">
      <Icon className="h-4 w-4" />
    </span>
  );
}

/** Icon, name, and the email or the team's size. */
function PrincipalLabel({
  principal,
  t,
}: Readonly<{ principal: Principal; t: T }>) {
  const detail =
    principal.kind === "team" && principal.size !== undefined
      ? t("teamSize", { count: String(principal.size) })
      : principal.detail;
  return (
    <>
      <PrincipalIcon kind={principal.kind} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-gray-900 dark:text-white">
          {principal.name}
        </span>
        {detail && (
          <span className="block truncate text-xs text-gray-500 dark:text-gray-400">
            {detail}
          </span>
        )}
      </span>
    </>
  );
}

/** Who an assignment names, from the directory or, failing that, its id. */
function principalOf(
  authorityId: string,
  directory: ReadonlyMap<string, Principal>,
  t: T
): Principal {
  const known = directory.get(principalKey(authorityId));
  if (known) return known;
  return authorityId.startsWith(TEAM_AUTHORITY_PREFIX)
    ? {
        authorityId,
        kind: "team",
        name: `${t("unknownTeam")} (${authorityId})`,
      }
    : { authorityId, kind: "member", name: authorityId };
}

/** A result under its header: icon, name and the email or the team's size. */
function PrincipalOption({
  principal,
  t,
}: Readonly<{ principal: Principal; t: T }>) {
  const detail =
    principal.kind === "team" && principal.size !== undefined
      ? t("teamSize", { count: String(principal.size) })
      : principal.detail;
  return (
    <span className="flex items-center gap-2.5">
      <PrincipalIcon kind={principal.kind} />
      <span className="min-w-0">
        <span className="block truncate text-sm text-gray-900 dark:text-white">
          {principal.name}
        </span>
        {detail && (
          <span className="block truncate text-xs text-gray-500 dark:text-gray-400">
            {detail}
          </span>
        )}
      </span>
    </span>
  );
}

/** The kinds in the order their sections are listed. */
const KINDS: readonly PrincipalKind[] = ["member", "team"];

interface AssignedRow {
  assignment: PermissionAssignment;
  principal: Principal;
}

interface AssignedListProps {
  rows: readonly AssignedRow[];
  onRole: (authorityId: string, role: PermissionAssignment["role"]) => void;
  onRemove: (authorityId: string) => void;
  t: T;
}

/** One assignment: who, their role on the right, and a remove button. */
function AssignedItem({
  row,
  onRole,
  onRemove,
  t,
}: Readonly<Omit<AssignedListProps, "rows"> & { row: AssignedRow }>) {
  const { assignment, principal } = row;
  return (
    <li className="flex items-center gap-2.5 px-3 py-2">
      <PrincipalLabel principal={principal} t={t} />
      <RolePicker
        value={assignment.role}
        onChange={(next) => onRole(assignment.authorityId, next)}
        label={t("roleOf", { name: principal.name })}
        t={t}
      />
      <button
        type="button"
        aria-label={t("removePerson", { name: principal.name })}
        title={t("removePerson", { name: principal.name })}
        onClick={() => onRemove(assignment.authorityId)}
        className="rounded-md p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/30"
      >
        <HiOutlineTrash className="h-4 w-4" />
      </button>
    </li>
  );
}

/**
 * Who has access, under a header per kind ("Miembros (2)", "Equipos (1)")
 * that stays on top while the list scrolls past its maximum height.
 */
function AssignedList({ rows, ...handlers }: Readonly<AssignedListProps>) {
  const { t } = handlers;
  return (
    <div className="max-h-72 overflow-y-auto rounded-lg border border-gray-200 dark:border-gray-700">
      {KINDS.map((kind) => {
        const inKind = rows.filter((row) => row.principal.kind === kind);
        if (inKind.length === 0) return null;
        const header = `${t(kind === "team" ? "teamsHeader" : "membersHeader")} (${inKind.length})`;
        return (
          <section key={kind} aria-label={header}>
            <h4 className="sticky top-0 z-10 flex items-center gap-1.5 border-b border-gray-200 bg-gray-50 px-3 py-1.5 text-xs font-semibold uppercase text-gray-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400">
              {kind === "team" ? (
                <HiOutlineUserGroup className="h-3.5 w-3.5" />
              ) : (
                <HiOutlineUser className="h-3.5 w-3.5" />
              )}
              {header}
            </h4>
            <ul className="divide-y divide-gray-100 dark:divide-gray-700">
              {inKind.map((row) => (
                <AssignedItem
                  key={row.assignment.authorityId}
                  row={row}
                  {...handlers}
                />
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

interface PermissionsStepProps {
  assignments: readonly PermissionAssignment[];
  onChange: (assignments: PermissionAssignment[]) => void;
  /** The organization's members and teams. */
  principals: readonly Principal[];
  loading: boolean;
  /** Whether the caller may decide who uses the dashboard. */
  canManage: boolean;
  /** Still finding out; shows the step's shape rather than "not yours". */
  checkingAccess?: boolean;
  error?: number | null;
  onRetry?: () => void;
  /** Who sees it; the switch shows only with `onVisibilityChange`. */
  visibility?: Visibility;
  onVisibilityChange?: (visibility: Visibility) => void;
  t: T;
}

const VISIBILITIES: readonly Visibility[] = ["organization", "restricted"];

/**
 * Everyone in the organization, or only who the list below names; what each
 * means shows on hover.
 */
function VisibilitySwitch({
  value,
  onChange,
  t,
}: Readonly<{
  value: Visibility;
  onChange: (visibility: Visibility) => void;
  t: T;
}>) {
  return (
    <SegmentedControl
      kind="radio"
      fill
      tooltip
      className="h-[38px]"
      label={t("visibility.label")}
      value={value}
      onChange={onChange}
      options={VISIBILITIES.map((key) => ({
        key,
        label: t(`visibility.${key}`),
        title: t(`visibility.${key}Help`),
        icon: key === "restricted" ? HiOutlineLockClosed : HiOutlineGlobeAlt,
      }))}
    />
  );
}

export function PermissionsStep({
  assignments,
  onChange,
  principals,
  loading,
  canManage,
  checkingAccess = false,
  error = null,
  onRetry,
  visibility = "organization",
  onVisibilityChange,
  t,
}: Readonly<PermissionsStepProps>) {
  const taken = useMemo(
    () => new Set(assignments.map((a) => principalKey(a.authorityId))),
    [assignments]
  );
  const items = useMemo<SearchItem[]>(
    () =>
      principals
        .filter((p) => !taken.has(principalKey(p.authorityId)))
        .map((p) => ({ ...p, id: p.authorityId })),
    [principals, taken]
  );
  const kindLabel = useCallback(
    (kind: string) => t(kind === "team" ? "teamsHeader" : "membersHeader"),
    [t]
  );
  const fields = useMemo<ReadonlyArray<SearchAutocompleteField<SearchItem>>>(
    () =>
      (["member", "team"] as const).map((kind) => ({
        matchType: kind,
        get: (item) => searchText(item, kind),
        label: kindLabel(kind),
        icon:
          kind === "team" ? (
            <HiOutlineUserGroup className={ICON} />
          ) : (
            <HiOutlineUser className={ICON} />
          ),
      })),
    [kindLabel]
  );
  const searchT = useCallback(
    (path: string) => (SEARCH_TEXTS[path] ? t(SEARCH_TEXTS[path]) : path),
    [t]
  );

  if (checkingAccess) {
    return (
      <output aria-busy="true" className="flex flex-col gap-4">
        <span className="sr-only">{t("loading")}</span>
        <div className="h-[38px] animate-pulse rounded-lg bg-gray-100 dark:bg-gray-700" />
        <div className="h-9 animate-pulse rounded-lg bg-gray-100 dark:bg-gray-700" />
      </output>
    );
  }
  if (error !== null) {
    return (
      <div role="alert" className="space-y-2 text-sm text-red-600">
        <p>{t(error === 409 ? "conflictError" : "loadError")}</p>
        <button type="button" onClick={onRetry} className="underline">
          {t(error === 409 ? "discardAndReload" : "retry")}
        </button>
      </div>
    );
  }
  if (!canManage) {
    return (
      <p className="text-sm text-gray-500 dark:text-gray-400">{t("locked")}</p>
    );
  }
  const directory = new Map(
    principals.map((p) => [principalKey(p.authorityId), p])
  );
  const add = (principal: Principal) => {
    const authorityId = principalKey(principal.authorityId);
    if (taken.has(authorityId)) return;
    onChange([...assignments, { authorityId, role: "Consumer" }]);
  };
  const setRole = (authorityId: string, role: PermissionAssignment["role"]) =>
    onChange(
      assignments.map((a) =>
        a.authorityId === authorityId ? { ...a, role } : a
      )
    );
  const remove = (authorityId: string) =>
    onChange(assignments.filter((a) => a.authorityId !== authorityId));

  return (
    <div className="flex flex-col gap-4">
      {onVisibilityChange && (
        <VisibilitySwitch
          value={visibility}
          onChange={onVisibilityChange}
          t={t}
        />
      )}
      <PlanningSearchAutocomplete
        services={items}
        fields={fields}
        t={searchT}
        isLoading={loading}
        onItemSelect={add}
        showWhenEmpty={SHOWN_BEFORE_TYPING}
        renderItem={(item) => <PrincipalOption principal={item} t={t} />}
      />
      {!loading && (
        <EmailPermissionForm
          taken={taken}
          onAdd={(email) =>
            add({ authorityId: email, kind: "member", name: email })
          }
          t={t}
        />
      )}
      {/* With the switch, its box below says what the empty list means. */}
      {assignments.length === 0 && !onVisibilityChange && (
        <EmptyBox>{t("noAccess")}</EmptyBox>
      )}
      {assignments.length > 0 && (
        <AssignedList
          rows={assignments.map((assignment) => ({
            assignment,
            principal: principalOf(assignment.authorityId, directory, t),
          }))}
          onRole={setRole}
          onRemove={remove}
          t={t}
        />
      )}
      {onVisibilityChange && <EmptyBox>{t("visibility.note")}</EmptyBox>}
    </div>
  );
}
