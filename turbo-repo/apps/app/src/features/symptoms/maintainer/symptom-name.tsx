"use client";

import { useEffect, useRef, useState } from "react";
import { HiPencilSquare } from "react-icons/hi2";
import { toast } from "sonner";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import { refreshSymptoms, updateIdentity } from "./maintainer-api";
import { useSymptomScope } from "./symptom-scope";

const TITLE = "text-2xl font-semibold text-gray-900 dark:text-white";

/**
 * The symptom's name in the header. Who may edit the symptom renames it in
 * place, as a dashboard is renamed: Enter or leaving the field saves, Escape
 * cancels.
 */
export default function SymptomName({
  id,
  name,
  canRename,
  d,
}: Readonly<{
  id: string;
  name: string;
  canRename: boolean;
  d: I18nRecord;
}>) {
  const scope = useSymptomScope();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(name);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  // Enter saves and unmounts the field; the blur that may follow must not save again.
  const closed = useRef(false);
  const label = tr("renameSymptom", d);

  useEffect(() => {
    if (!editing && !saving) setValue(name);
  }, [name, editing, saving]);

  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  const start = () => {
    closed.current = false;
    setEditing(true);
  };

  const cancel = () => {
    closed.current = true;
    setValue(name);
    setEditing(false);
  };

  const commit = async () => {
    if (closed.current) return;
    closed.current = true;
    const trimmed = value.trim();
    setEditing(false);
    if (!trimmed || trimmed === name) {
      setValue(name);
      return;
    }
    setValue(trimmed);
    setSaving(true);
    try {
      await updateIdentity(id, { name: trimmed }, scope);
      await refreshSymptoms(id, scope);
    } catch {
      setValue(name);
      toast.error(tr("renameSymptomFailed", d));
    } finally {
      setSaving(false);
    }
  };

  if (!canRename) return <h1 className={TITLE}>{name}</h1>;

  if (editing) {
    return (
      <h1 className={TITLE}>
        <input
          ref={inputRef}
          autoFocus
          aria-label={label}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={() => void commit()}
          onKeyDown={(e) => {
            if (e.key === "Enter") void commit();
            else if (e.key === "Escape") cancel();
          }}
          className="w-full min-w-48 border-b border-gray-400 bg-transparent outline-none focus:border-blue-500 dark:focus:border-blue-500"
        />
      </h1>
    );
  }

  return (
    <h1 className={TITLE}>
      <button
        type="button"
        disabled={saving}
        onClick={start}
        title={tr("clickToRename", d)}
        className="group flex cursor-text items-center gap-1.5 decoration-dashed underline-offset-4 hover:underline disabled:cursor-wait"
      >
        <span className={saving ? "opacity-60" : undefined}>{value}</span>
        {saving ? (
          <span className="text-xs font-normal text-gray-500 dark:text-gray-400">
            {tr("renamingSymptom", d)}
          </span>
        ) : (
          <>
            <span className="sr-only">{label}</span>
            <HiPencilSquare
              aria-hidden
              className="h-4 w-4 text-gray-400 group-hover:text-gray-600 dark:text-gray-500 dark:group-hover:text-gray-300"
            />
          </>
        )}
      </button>
    </h1>
  );
}
