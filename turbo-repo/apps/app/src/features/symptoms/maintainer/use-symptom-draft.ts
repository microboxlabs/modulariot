"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { mutate as globalMutate } from "swr";
import {
  discardDraft,
  previewSpec,
  publishPlanKey,
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
  // The spec the preview was made for: a preview of an earlier spec must not describe the one on screen.
  const [previewFor, setPreviewFor] = useState<SymptomSpec | null>(null);
  // The spec the publish plan was made for: the saved draft, once its plan has reloaded.
  const [planFor, setPlanFor] = useState<SymptomSpec | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loadedFor = useRef<string | null>(null);
  // Checks run one after another, and only the latest one's results are kept.
  const queue = useRef<Promise<void>>(Promise.resolve());
  const latest = useRef(0);

  const base = detail?.draft?.spec ?? detail?.current?.spec ?? null;

  // A new symptom starts clean: nothing from the previous one's checks.
  useEffect(() => {
    loadedFor.current = null;
    setSpec(null);
    setReport(null);
    setPreview(null);
  }, [id]);

  // Take the server's spec once per load; later edits stay local.
  useEffect(() => {
    if (base && loadedFor.current !== id) {
      loadedFor.current = id;
      setSpec(base);
      setPlanFor(base);
    }
  }, [base, id]);

  const check = useCallback(
    (next: SymptomSpec, save: boolean) => {
      const ticket = ++latest.current;
      queue.current = queue.current.then(async () => {
        try {
          if (save) {
            setSaving(true);
            await saveDraft(id, next);
            setSaveError(null);
            void mutate();
            void refreshSymptoms();
            void globalMutate(publishPlanKey(id)).then(() => {
              if (ticket === latest.current) setPlanFor(next);
            });
          }
          if (ticket !== latest.current) return;
          const [r, p] = await Promise.all([
            validateSpec(id, next),
            previewSpec(id, next),
          ]);
          if (ticket !== latest.current) return;
          setReport(r);
          setPreview(p);
          setPreviewFor(next);
        } catch (e) {
          setSaveError(e instanceof Error ? e.message : String(e));
        } finally {
          if (ticket === latest.current) setSaving(false);
        }
      });
      return queue.current;
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

  /** Reloads the editor from the server, after a publish, restore or discard changed it there. */
  const resync = useCallback(async () => {
    if (timer.current) clearTimeout(timer.current);
    const fresh = await mutate();
    const next = fresh?.draft?.spec ?? fresh?.current?.spec ?? null;
    loadedFor.current = id;
    setSpec(next);
    setPlanFor(next);
    setReport(null);
  }, [id, mutate]);

  const discard = useCallback(async () => {
    await discardDraft(id);
    await refreshSymptoms();
    await resync();
  }, [id, resync]);

  return {
    detail,
    error,
    spec,
    update,
    report,
    preview,
    /** The preview, only while it describes the spec on screen. */
    currentPreview: preview && previewFor === spec ? preview : null,
    /** Whether the publish plan describes the spec on screen. */
    planIsCurrent: spec !== null && planFor === spec,
    saving,
    saveError,
    discard,
    resync,
  };
}
