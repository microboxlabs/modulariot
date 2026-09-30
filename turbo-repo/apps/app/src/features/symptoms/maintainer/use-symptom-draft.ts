"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  discardDraft,
  previewSpec,
  refreshSymptoms,
  saveDraft,
  useSymptomDefinition,
  validateSpec,
  type Preview,
  type SymptomSpec,
  type ValidationReport,
} from "./maintainer-api";

const DEBOUNCE_MS = 600;

/**
 * The spec being edited on the symptom page. Starts from the draft (else the
 * version in force). Each change is checked and previewed by the server after
 * a short pause; owners also save it as the draft.
 */
export function useSymptomDraft(id: string, canWrite: boolean) {
  const { data: detail, error, mutate } = useSymptomDefinition(id);
  const [spec, setSpec] = useState<SymptomSpec | null>(null);
  const [report, setReport] = useState<ValidationReport | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loadedFor = useRef<string | null>(null);

  const base = detail?.draft?.spec ?? detail?.current?.spec ?? null;

  // Take the server's spec once per symptom, then keep local edits.
  useEffect(() => {
    if (base && loadedFor.current !== id) {
      loadedFor.current = id;
      setSpec(base);
    }
  }, [base, id]);

  const check = useCallback(
    async (next: SymptomSpec, save: boolean) => {
      try {
        if (save) {
          setSaving(true);
          await saveDraft(id, next);
          setSaveError(null);
          void mutate();
          void refreshSymptoms();
        }
        const [r, p] = await Promise.all([validateSpec(id, next), previewSpec(id, next)]);
        setReport(r);
        setPreview(p);
      } catch (e) {
        setSaveError(e instanceof Error ? e.message : String(e));
      } finally {
        setSaving(false);
      }
    },
    [id, mutate]
  );

  // First check once the spec is loaded, without saving.
  useEffect(() => {
    if (spec && !report) void check(spec, false);
  }, [spec, report, check]);

  const update = useCallback(
    (next: SymptomSpec) => {
      setSpec(next);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => void check(next, canWrite), DEBOUNCE_MS);
    },
    [check, canWrite]
  );

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    []
  );

  const discard = useCallback(async () => {
    await discardDraft(id);
    loadedFor.current = null;
    setReport(null);
    await mutate();
    await refreshSymptoms();
  }, [id, mutate]);

  return { detail, error, spec, update, report, preview, saving, saveError, discard, reload: mutate };
}
