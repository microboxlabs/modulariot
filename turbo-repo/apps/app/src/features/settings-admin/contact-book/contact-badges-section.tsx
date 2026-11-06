"use client";

import { useState, type KeyboardEvent } from "react";
import {
  HiCheck,
  HiOutlineLocationMarker,
  HiOutlinePencil,
  HiOutlineTrash,
  HiPlus,
  HiX,
} from "react-icons/hi";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import { SECTION_INPUT_CLASS } from "./contact-person-section";
import type { TowerTripPlace } from "@/features/symptoms/control-tower/control-tower-api";
import { normalizeLabel, type ContactBadge } from "./taxonomy-store";

/** The most trip places listed under the input. */
const MAX_PLACES = 8;

/**
 * The trip places that match `query` and are not a tag yet, so a tag can be
 * written exactly as the trips name the place.
 */
export function placeSuggestions(
  places: readonly TowerTripPlace[],
  badges: readonly ContactBadge[],
  query: string
): TowerTripPlace[] {
  const key = normalizeLabel(query);
  if (!key) return [];
  const taken = new Set(badges.map((b) => normalizeLabel(b.name)));
  return places
    .filter((p) => {
      const label = normalizeLabel(p.label);
      return label.includes(key) && !taken.has(label);
    })
    .slice(0, MAX_PLACES);
}

/** "Origen de 3 viajes · destino de 1", leaving out a zero. */
export function placeDetail(place: TowerTripPlace, d: I18nRecord): string {
  const parts: string[] = [];
  if (place.origins > 0)
    parts.push(tr("badgesPlaceOrigin", d, { count: String(place.origins) }));
  if (place.destinations > 0)
    parts.push(
      tr("badgesPlaceDestination", d, { count: String(place.destinations) })
    );
  return parts.join(" · ");
}

export const BADGE_CLASS =
  "inline-flex items-center gap-1 whitespace-nowrap rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-0.5 text-xs font-medium text-indigo-700 dark:border-indigo-500/40 dark:bg-indigo-500/10 dark:text-indigo-300";

function BadgeEditor({
  initial,
  onSave,
  onCancel,
  d,
}: Readonly<{
  initial: string;
  onSave: (name: string) => boolean;
  onCancel: () => void;
  d: I18nRecord;
}>) {
  const [name, setName] = useState(initial);
  const [error, setError] = useState(false);
  const save = () => {
    if (onSave(name)) return;
    setError(true);
  };
  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      save();
    } else if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      onCancel();
    }
  };
  return (
    <span className="flex items-center gap-1">
      <input
        aria-label={tr("badgeRename", d)}
        aria-invalid={error}
        className={`w-32 rounded-md border bg-white px-2 py-0.5 text-xs text-gray-900 focus:outline-none dark:bg-gray-900 dark:text-white ${
          error ? "border-red-400" : "border-gray-300 dark:border-gray-600"
        }`}
        value={name}
        onChange={(e) => {
          setName(e.target.value);
          setError(false);
        }}
        onKeyDown={handleKeyDown}
      />
      <button
        type="button"
        aria-label={tr("save", d)}
        onClick={save}
        className="text-green-600 hover:text-green-700"
      >
        <HiCheck className="h-4 w-4" />
      </button>
      <button
        type="button"
        aria-label={tr("cancel", d)}
        onClick={onCancel}
        className="text-gray-400 hover:text-gray-600"
      >
        <HiX className="h-4 w-4" />
      </button>
    </span>
  );
}

/** One match under the input: click to add/remove it from the contact,
 *  with rename and delete actions. */
function BadgeSuggestion({
  badge,
  selected,
  onToggle,
  onRename,
  onDelete,
  d,
}: Readonly<{
  badge: ContactBadge;
  selected: boolean;
  onToggle: () => void;
  onRename: (name: string) => boolean;
  onDelete: () => void;
  d: I18nRecord;
}>) {
  const [editing, setEditing] = useState(false);
  if (editing) {
    return (
      <li className="px-3 py-1.5">
        <BadgeEditor
          initial={badge.name}
          onSave={(name) => {
            const ok = onRename(name);
            if (ok) setEditing(false);
            return ok;
          }}
          onCancel={() => setEditing(false)}
          d={d}
        />
      </li>
    );
  }
  return (
    <li className="group flex items-center gap-1 pr-2 transition-colors hover:bg-gray-50 dark:hover:bg-gray-700/50">
      <button
        type="button"
        aria-pressed={selected}
        onClick={onToggle}
        className="flex min-w-0 flex-1 items-center gap-2 px-3 py-1.5 text-left text-sm text-gray-700 dark:text-gray-200"
      >
        <span className={BADGE_CLASS}>{badge.name}</span>
        {selected && (
          <HiCheck className="h-4 w-4 shrink-0 text-indigo-600 dark:text-indigo-300" />
        )}
      </button>
      <button
        type="button"
        aria-label={`${tr("badgeRename", d)} ${badge.name}`}
        onClick={() => setEditing(true)}
        className="rounded p-1 text-gray-400 opacity-60 transition hover:text-gray-700 hover:opacity-100 group-hover:opacity-100 dark:hover:text-gray-200"
      >
        <HiOutlinePencil className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        aria-label={`${tr("badgeDelete", d)} ${badge.name}`}
        onClick={onDelete}
        className="rounded p-1 text-gray-400 opacity-60 transition hover:text-red-600 hover:opacity-100 group-hover:opacity-100"
      >
        <HiOutlineTrash className="h-3.5 w-3.5" />
      </button>
    </li>
  );
}

/**
 * Agrupación card — badges are shared descriptors ([transportista] [norte]
 * [santiago]). Type in the input: existing badges that match show up to add
 * (and rename or delete), then the live trips' origins and destinations that
 * are not a badge yet; when none matches exactly, a "Crear" option makes a
 * new one from the typed text. The contact's descriptors are listed below.
 */
export default function ContactBadgesSection({
  selectedIds,
  onChange,
  badges,
  onCreate,
  onRename,
  onDelete,
  places = [],
  d,
}: Readonly<{
  selectedIds: readonly string[];
  onChange: (ids: string[]) => void;
  badges: readonly ContactBadge[];
  onCreate: (name: string) => ContactBadge;
  onRename: (id: string, name: string) => boolean;
  onDelete: (id: string) => void;
  /** The live trips' places, offered as new tags. */
  places?: readonly TowerTripPlace[];
  d: I18nRecord;
}>) {
  const [query, setQuery] = useState("");
  const key = normalizeLabel(query);
  const exact = badges.find((b) => normalizeLabel(b.name) === key);
  const matches = key
    ? badges.filter((b) => normalizeLabel(b.name).includes(key))
    : [];
  const placeMatches = placeSuggestions(places, badges, query);
  const exactPlace = placeMatches.find((p) => normalizeLabel(p.label) === key);
  const selected = badges.filter((b) => selectedIds.includes(b.id));

  const toggle = (id: string) =>
    onChange(
      selectedIds.includes(id)
        ? selectedIds.filter((x) => x !== id)
        : [...selectedIds, id]
    );

  const add = (badge: ContactBadge) => {
    if (!selectedIds.includes(badge.id)) onChange([...selectedIds, badge.id]);
    setQuery("");
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== "Enter" || !key) return;
    e.preventDefault();
    add(exact ?? onCreate(exactPlace?.label ?? query));
  };

  const handleDelete = (id: string) => {
    onDelete(id);
    if (selectedIds.includes(id)) onChange(selectedIds.filter((x) => x !== id));
  };

  return (
    <div className="flex flex-1 flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <input
          className={SECTION_INPUT_CLASS}
          placeholder={tr("badgesInputPlaceholder", d)}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        {key && (
          <ul className="max-h-48 divide-y divide-gray-100 overflow-y-auto rounded-lg border border-gray-200 dark:divide-gray-700 dark:border-gray-700">
            {matches.map((b) => (
              <BadgeSuggestion
                key={b.id}
                badge={b}
                selected={selectedIds.includes(b.id)}
                onToggle={() => toggle(b.id)}
                onRename={(name) => onRename(b.id, name)}
                onDelete={() => handleDelete(b.id)}
                d={d}
              />
            ))}
            {placeMatches.map((p) => (
              <li key={`place-${p.label}`}>
                <button
                  type="button"
                  onClick={() => add(onCreate(p.label))}
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-gray-700 transition-colors hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-700/50"
                >
                  <HiOutlineLocationMarker className="h-4 w-4 shrink-0 text-gray-400" />
                  <span className="truncate">{p.label}</span>
                  <span className="ml-auto shrink-0 text-xs text-gray-500 dark:text-gray-400">
                    {placeDetail(p, d)}
                  </span>
                </button>
              </li>
            ))}
            {!exact && !exactPlace && (
              <li>
                <button
                  type="button"
                  onClick={() => add(onCreate(query))}
                  className="flex w-full items-center gap-1.5 px-3 py-2 text-left text-sm font-medium text-blue-600 transition-colors hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-500/10"
                >
                  <HiPlus className="h-4 w-4 shrink-0" />
                  <span className="truncate">
                    {tr("badgesCreate", d, { name: query.trim() })}
                  </span>
                </button>
              </li>
            )}
          </ul>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-1.5">
        <span className="text-xs font-medium text-gray-600 dark:text-gray-300">
          {tr("badgesSelectedTitle", d)}
        </span>
        <div className="flex min-h-9 flex-1 flex-wrap content-start items-center gap-1.5 rounded-lg border border-dashed border-gray-300 px-2 py-1.5 dark:border-gray-600">
          {selected.length === 0 && (
            <span className="px-1 text-xs text-gray-400 dark:text-gray-500">
              {tr("badgesSelectedEmpty", d)}
            </span>
          )}
          {selected.map((b) => (
            <span key={b.id} className={BADGE_CLASS}>
              {b.name}
              <button
                type="button"
                aria-label={`${tr("remove", d)} ${b.name}`}
                onClick={() => toggle(b.id)}
                className="opacity-60 transition-opacity hover:opacity-100"
              >
                <HiX className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
