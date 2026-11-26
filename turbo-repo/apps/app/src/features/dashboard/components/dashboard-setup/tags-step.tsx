"use client";

import { HiOutlinePlus, HiOutlineTag } from "react-icons/hi";
import TagPicker, {
  normalizeTag,
  tagsFromNames,
} from "@/features/common/components/tag-picker/tag-picker";

type T = (key: string, params?: Record<string, string>) => string;

const MAX_TAGS = 20;
const MAX_TAG_LENGTH = 40;

/** The permissions step's search box, so both steps' fields look alike. */
const FIELD_CLASS =
  "rounded-lg bg-white transition-colors placeholder:text-gray-400 focus:ring-0 dark:bg-gray-700 dark:placeholder:text-gray-500 dark:focus:border-blue-400";

/**
 * Labels that help find the dashboard in the list. Also the explorer's tags
 * dialog, which passes the tags the organization already uses in `known`:
 * they come first among the suggestions.
 */
export function TagsStep({
  tags,
  onChange,
  t,
  known = [],
  autoFocus = false,
}: Readonly<{
  tags: string[];
  onChange: (tags: string[]) => void;
  t: T;
  known?: readonly string[];
  autoFocus?: boolean;
}>) {
  const suggested = [
    ...known,
    ...t("suggested")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  ].filter(
    (name, index, all) =>
      all.findIndex((other) => normalizeTag(other) === normalizeTag(name)) ===
      index
  );
  const has = (name: string) =>
    tags.some((tag) => normalizeTag(tag) === normalizeTag(name));
  const suggestions = suggested.filter((s) => !has(s));
  const add = (name: string) => {
    if (!has(name) && tags.length < MAX_TAGS) onChange([...tags, name]);
  };
  return (
    <div className="flex flex-col gap-4">
      <TagPicker
        options={tagsFromNames([...tags, ...suggested])}
        selectedIds={tags}
        onChange={onChange}
        onCreate={(name) => ({ id: name.trim(), name: name.trim() })}
        max={MAX_TAGS}
        maxLength={MAX_TAG_LENGTH}
        autoFocus={autoFocus}
        icon={HiOutlineTag}
        inputClassName={FIELD_CLASS}
        labels={{
          placeholder: t("placeholder"),
          create: (name) => t("create", { name }),
          remove: (tag) => t("remove", { tag }),
          empty: t("empty"),
        }}
      />
      {suggestions.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {t("suggestions")}
          </span>
          {suggestions.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              onClick={() => add(suggestion)}
              className="inline-flex items-center gap-1 rounded-full border border-dashed border-gray-300 px-2.5 py-0.5 text-xs text-gray-600 hover:border-indigo-400 hover:text-indigo-700 dark:border-gray-600 dark:text-gray-300 dark:hover:text-indigo-300"
            >
              <HiOutlinePlus className="h-3 w-3" />
              {suggestion}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
