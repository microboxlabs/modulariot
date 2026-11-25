"use client";

/**
 * Tags written by hand, picked from the ones that already exist.
 *
 * Type in the field: the tags that match show up to add or take off (and,
 * where the page allows it, to rename or delete), then any extra
 * suggestions the page has (trip places, say), and a "Create" option when
 * nothing matches exactly. Enter takes the exact match, or creates the tag.
 * The tags on the record are listed under the field.
 *
 * The component keeps no tags of its own: the page passes the list it has
 * and says what creating, renaming and deleting mean there.
 */
import {
  useEffect,
  useRef,
  useState,
  type ComponentProps,
  type FC,
  type KeyboardEvent,
} from "react";
import {
  autoUpdate,
  flip,
  offset,
  size,
  useFloating,
} from "@floating-ui/react";
import {
  HiCheck,
  HiOutlinePencil,
  HiOutlineTrash,
  HiPlus,
  HiX,
} from "react-icons/hi";
import { twMerge } from "tailwind-merge";

export interface TagOption {
  id: string;
  name: string;
}

/** A suggestion that is not a tag yet: picking it creates a tag named `label`. */
export interface TagExtra {
  label: string;
  /** A short note beside it, e.g. "origin of 3 live trips". */
  detail?: string;
}

export interface TagPickerLabels {
  placeholder: string;
  create: (name: string) => string;
  remove: (name: string) => string;
  /** Present when the page lets tags be renamed. */
  rename?: string;
  renameOf?: (name: string) => string;
  deleteOf?: (name: string) => string;
  save?: string;
  cancel?: string;
  /** Title of the tags on the record; without it, no title is shown. */
  selectedTitle?: string;
  /** Shown while the record has no tags. */
  empty?: string;
}

export interface TagPickerProps {
  /** Every tag that exists. */
  options: readonly TagOption[];
  /** The ids of the tags on this record. */
  selectedIds: readonly string[];
  onChange: (ids: string[]) => void;
  /** Creates the tag named `name` (or finds it) and returns it. */
  onCreate: (name: string) => TagOption;
  /** Renames a tag; false when the name cannot be used. Omit to not offer it. */
  onRename?: (id: string, name: string) => boolean;
  /** Deletes a tag everywhere. Omit to not offer it. */
  onDelete?: (id: string) => void;
  /** More things that can become a tag, matched against the typed text. */
  extras?: readonly TagExtra[];
  /** Icon beside each extra. */
  extraIcon?: FC<ComponentProps<"svg">>;
  /** The most extras listed at once. */
  maxExtras?: number;
  /** The most tags a record may carry. */
  max?: number;
  /** The longest name a new tag may have. */
  maxLength?: number;
  labels: TagPickerLabels;
  inputClassName?: string;
  /** An icon at the start of the field, as search boxes have. */
  icon?: FC<ComponentProps<"svg">>;
  /** Puts the cursor in the field at once, e.g. when a dialog opens. */
  autoFocus?: boolean;
}

/**
 * For pages whose tags are plain names (no catalogue with ids): every name
 * is its own id. `names` should already hold the record's own tags.
 */
export function tagsFromNames(names: readonly string[]): TagOption[] {
  const seen = new Set<string>();
  return names.flatMap((name) => {
    const key = normalizeTag(name);
    if (!key || seen.has(key)) return [];
    seen.add(key);
    return [{ id: name, name }];
  });
}

/** Ignores case, accents and repeated spaces, as tags are compared everywhere. */
export function normalizeTag(value: string): string {
  return value
    .normalize("NFD")
    .replaceAll(/\p{M}+/gu, "")
    .toLowerCase()
    .replaceAll(/[\p{White_Space}\uFEFF]+/gu, " ")
    .trim();
}

/**
 * The extras that match `query` and are not a tag yet, the exact one first,
 * at most `max` of them.
 */
export function matchingExtras<E extends TagExtra>(
  extras: readonly E[],
  options: readonly TagOption[],
  query: string,
  max: number
): E[] {
  const key = normalizeTag(query);
  if (!key) return [];
  const taken = new Set(options.map((o) => normalizeTag(o.name)));
  return extras
    .filter((extra) => {
      const label = normalizeTag(extra.label);
      return label.includes(key) && !taken.has(label);
    })
    .sort(
      (a, b) =>
        Number(normalizeTag(b.label) === key) -
        Number(normalizeTag(a.label) === key)
    )
    .slice(0, max);
}

export const TAG_CHIP_CLASS =
  "inline-flex items-center gap-1 whitespace-nowrap rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-0.5 text-xs font-medium text-indigo-700 dark:border-indigo-500/40 dark:bg-indigo-500/10 dark:text-indigo-300";

/** The field's look; other fields in the same form use it to match. */
export const TAG_FIELD_CLASS =
  "w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-900 dark:text-white";

function TagNameEditor({
  initial,
  labels,
  onSave,
  onCancel,
}: Readonly<{
  initial: string;
  labels: TagPickerLabels;
  onSave: (name: string) => boolean;
  onCancel: () => void;
}>) {
  const [name, setName] = useState(initial);
  const [error, setError] = useState(false);
  const field = useRef<HTMLInputElement>(null);
  // Focused once it opens, without the autoFocus attribute.
  useEffect(() => field.current?.focus(), []);
  const save = () => {
    if (!onSave(name)) setError(true);
  };
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      save();
    } else if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      onCancel();
    }
  };
  return (
    <span className="flex items-center gap-1">
      <input
        ref={field}
        aria-label={labels.rename}
        aria-invalid={error}
        value={name}
        onChange={(event) => {
          setName(event.target.value);
          setError(false);
        }}
        onKeyDown={onKeyDown}
        className={twMerge(
          "w-32 rounded-md border bg-white px-2 py-0.5 text-xs text-gray-900 focus:outline-none dark:bg-gray-900 dark:text-white",
          error ? "border-red-400" : "border-gray-300 dark:border-gray-600"
        )}
      />
      <button
        type="button"
        aria-label={labels.save}
        onClick={save}
        className="text-green-600 hover:text-green-700"
      >
        <HiCheck className="h-4 w-4" />
      </button>
      <button
        type="button"
        aria-label={labels.cancel}
        onClick={onCancel}
        className="text-gray-400 hover:text-gray-600"
      >
        <HiX className="h-4 w-4" />
      </button>
    </span>
  );
}

/** One existing tag in the list under the field. */
function TagSuggestion({
  tag,
  selected,
  labels,
  onToggle,
  onRename,
  onDelete,
}: Readonly<{
  tag: TagOption;
  selected: boolean;
  labels: TagPickerLabels;
  onToggle: () => void;
  onRename?: (name: string) => boolean;
  onDelete?: () => void;
}>) {
  const [editing, setEditing] = useState(false);
  if (editing && onRename) {
    return (
      <li className="px-3 py-1.5">
        <TagNameEditor
          initial={tag.name}
          labels={labels}
          onSave={(name) => {
            const ok = onRename(name);
            if (ok) setEditing(false);
            return ok;
          }}
          onCancel={() => setEditing(false)}
        />
      </li>
    );
  }
  return (
    <li className="group flex items-center gap-1 pr-2 transition-colors hover:bg-gray-50 dark:hover:bg-gray-600">
      <button
        type="button"
        aria-pressed={selected}
        onClick={onToggle}
        className="flex min-w-0 flex-1 items-center gap-2 px-3 py-1.5 text-left text-sm text-gray-700 dark:text-gray-200"
      >
        <span className={TAG_CHIP_CLASS}>{tag.name}</span>
        {selected && (
          <HiCheck className="h-4 w-4 shrink-0 text-indigo-600 dark:text-indigo-300" />
        )}
      </button>
      {onRename && labels.renameOf && (
        <button
          type="button"
          aria-label={labels.renameOf(tag.name)}
          onClick={() => setEditing(true)}
          className="rounded p-1 text-gray-400 opacity-60 transition hover:text-gray-700 hover:opacity-100 group-hover:opacity-100 dark:hover:text-gray-200"
        >
          <HiOutlinePencil className="h-3.5 w-3.5" />
        </button>
      )}
      {onDelete && labels.deleteOf && (
        <button
          type="button"
          aria-label={labels.deleteOf(tag.name)}
          onClick={onDelete}
          className="rounded p-1 text-gray-400 opacity-60 transition hover:text-red-600 hover:opacity-100 group-hover:opacity-100"
        >
          <HiOutlineTrash className="h-3.5 w-3.5" />
        </button>
      )}
    </li>
  );
}

function ExtraSuggestion({
  extra,
  icon: Icon,
  onPick,
}: Readonly<{
  extra: TagExtra;
  icon?: FC<ComponentProps<"svg">>;
  onPick: () => void;
}>) {
  return (
    <li>
      <button
        type="button"
        onClick={onPick}
        className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-gray-700 transition-colors hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-600"
      >
        {Icon && <Icon className="h-4 w-4 shrink-0 text-gray-400" />}
        <span className="truncate">{extra.label}</span>
        {extra.detail && (
          <span className="ml-auto shrink-0 text-xs text-gray-500 dark:text-gray-400">
            {extra.detail}
          </span>
        )}
      </button>
    </li>
  );
}

function SelectedTags({
  tags,
  labels,
  onRemove,
}: Readonly<{
  tags: readonly TagOption[];
  labels: TagPickerLabels;
  onRemove: (id: string) => void;
}>) {
  return (
    <div className="flex flex-1 flex-col gap-1.5">
      {labels.selectedTitle && (
        <span className="text-xs font-medium text-gray-600 dark:text-gray-300">
          {labels.selectedTitle}
        </span>
      )}
      <div
        className={twMerge(
          "flex min-h-9 flex-1 flex-wrap content-start items-center gap-1.5 rounded-lg border border-dashed border-gray-300 px-2 py-1.5 dark:border-gray-600",
          // A stretched box keeps its chips at the top, but the empty
          // message sits in the middle, as the other empty boxes do.
          tags.length === 0 && "content-center"
        )}
      >
        {tags.length === 0 && labels.empty && (
          <span className="px-1 text-xs text-gray-400 dark:text-gray-500">
            {labels.empty}
          </span>
        )}
        {tags.map((tag) => (
          <span key={tag.id} className={TAG_CHIP_CLASS}>
            {tag.name}
            <button
              type="button"
              aria-label={labels.remove(tag.name)}
              onClick={() => onRemove(tag.id)}
              className="opacity-60 transition-opacity hover:opacity-100"
            >
              <HiX className="h-3 w-3" />
            </button>
          </span>
        ))}
      </div>
    </div>
  );
}

export default function TagPicker({
  options,
  selectedIds,
  onChange,
  onCreate,
  onRename,
  onDelete,
  extras = [],
  extraIcon,
  maxExtras = 8,
  max,
  maxLength,
  labels,
  inputClassName,
  icon: Icon,
  autoFocus = false,
}: Readonly<TagPickerProps>) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const field = useRef<HTMLInputElement | null>(null);
  const key = normalizeTag(query);
  const showList = open && key.length > 0;
  // The list floats under the field, as wide as it, instead of pushing the
  // page down; `fixed` keeps a dialog's scrolling body from clipping it.
  const { refs, floatingStyles } = useFloating({
    open: showList,
    strategy: "fixed",
    placement: "bottom-start",
    whileElementsMounted: autoUpdate,
    middleware: [
      offset(4),
      flip({ padding: 8 }),
      size({
        apply({ rects, elements }) {
          elements.floating.style.width = `${rects.reference.width}px`;
        },
      }),
    ],
  });

  // Focused on mount when asked, without the autoFocus attribute.
  useEffect(() => {
    if (autoFocus) field.current?.focus();
    // Only when it mounts, as the attribute would.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // A click anywhere else closes the list; the list is inside `root`.
  useEffect(() => {
    if (!showList) return;
    const close = (event: MouseEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [showList]);
  const exact = options.find((o) => normalizeTag(o.name) === key);
  // Looked for in every extra, not only the ones listed, so the tag is
  // written as the extra writes it even beyond `maxExtras`.
  const exactExtra = extras.find((e) => normalizeTag(e.label) === key);
  const matches = key
    ? options.filter((o) => normalizeTag(o.name).includes(key))
    : [];
  const shownExtras = matchingExtras(extras, options, query, maxExtras);
  const selected = selectedIds.flatMap(
    (id) => options.find((o) => o.id === id) ?? []
  );
  const full = max !== undefined && selectedIds.length >= max;

  const toggle = (id: string) =>
    onChange(
      selectedIds.includes(id)
        ? selectedIds.filter((x) => x !== id)
        : [...selectedIds, id]
    );
  const add = (tag: TagOption) => {
    if (!selectedIds.includes(tag.id) && !full) {
      onChange([...selectedIds, tag.id]);
    }
    setQuery("");
  };
  const create = (name: string) => {
    if (full) return;
    add(onCreate(maxLength ? name.trim().slice(0, maxLength) : name));
  };
  const deleteTag = (id: string) => {
    onDelete?.(id);
    if (selectedIds.includes(id)) onChange(selectedIds.filter((x) => x !== id));
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape" && showList) {
      // Closes the list, not the dialog the picker may sit in.
      event.preventDefault();
      event.stopPropagation();
      setOpen(false);
      return;
    }
    if (event.key !== "Enter" || !key) return;
    event.preventDefault();
    if (exact) add(exact);
    else create(exactExtra?.label ?? query);
  };

  return (
    <div className="flex flex-1 flex-col gap-4">
      <div ref={root} className="relative flex flex-col gap-1.5">
        {Icon && (
          <span className="pointer-events-none absolute left-0 top-0 flex h-[38px] items-center pl-3">
            <Icon className="h-4 w-4 text-gray-400 dark:text-gray-500" />
          </span>
        )}
        <input
          ref={(node) => {
            refs.setReference(node);
            field.current = node;
          }}
          className={twMerge(TAG_FIELD_CLASS, Icon && "pl-10", inputClassName)}
          placeholder={labels.placeholder}
          aria-label={labels.placeholder}
          value={query}
          maxLength={maxLength}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          // Clicking the field again brings back a list closed with Escape.
          onClick={() => setOpen(true)}
          onKeyDown={onKeyDown}
        />
        {showList && (
          <ul
            ref={refs.setFloating}
            style={floatingStyles}
            className="z-50 max-h-60 divide-y divide-gray-100 overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-md dark:divide-gray-600 dark:border-gray-600 dark:bg-gray-700 dark:shadow-black/30"
          >
            {matches.map((tag) => (
              <TagSuggestion
                key={tag.id}
                tag={tag}
                selected={selectedIds.includes(tag.id)}
                labels={labels}
                onToggle={() => toggle(tag.id)}
                onRename={onRename && ((name) => onRename(tag.id, name))}
                onDelete={onDelete && (() => deleteTag(tag.id))}
              />
            ))}
            {shownExtras.map((extra) => (
              <ExtraSuggestion
                key={`extra-${extra.label}`}
                extra={extra}
                icon={extraIcon}
                onPick={() => create(extra.label)}
              />
            ))}
            {!exact && !exactExtra && (
              <li>
                <button
                  type="button"
                  disabled={full}
                  onClick={() => create(query)}
                  className="flex w-full items-center gap-1.5 px-3 py-2 text-left text-sm font-medium text-blue-600 transition-colors hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50 dark:text-blue-400 dark:hover:bg-blue-500/10"
                >
                  <HiPlus className="h-4 w-4 shrink-0" />
                  <span className="truncate">
                    {labels.create(query.trim())}
                  </span>
                </button>
              </li>
            )}
          </ul>
        )}
      </div>
      <SelectedTags tags={selected} labels={labels} onRemove={toggle} />
    </div>
  );
}
