"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { mutate as globalMutate } from "swr";
import { formatRule } from "./condition-form";
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

/** The spec as the sheet shows it: the activation one condition per line. Nothing is saved until an edit. */
function shown(spec: SymptomSpec | null): SymptomSpec | null {
  if (!spec?.activation) return spec;
  const activation = formatRule(spec.activation);
  return activation === spec.activation ? spec : { ...spec, activation };
}

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
  // The draft as this page last loaded or saved it, to notice a draft written elsewhere (Harness, another tab).
  const known = useRef<string | null>(null);
  // Edits on screen that are not saved yet.
  const dirty = useRef(false);
  const [external, setExternal] = useState(false);

  const base = detail?.draft?.spec ?? detail?.current?.spec ?? null;

  // A new symptom starts clean: nothing from the previous one's checks.
  useEffect(() => {
    loadedFor.current = null;
    known.current = null;
    dirty.current = false;
    setExternal(false);
    setSpec(null);
    setReport(null);
    setPreview(null);
  }, [id]);

  // Take the server's spec once per load; later edits stay local.
  useEffect(() => {
    if (base && loadedFor.current !== id) {
      loadedFor.current = id;
      known.current = JSON.stringify(detail?.draft?.spec ?? null);
      dirty.current = false;
      const loaded = shown(base);
      setSpec(loaded);
      setPlanFor(loaded);
    }
  }, [base, id, detail]);

  // A draft written elsewhere: taken at once when nothing here is unsaved, else offered.
  const serverDraft = detail?.draft?.spec ?? null;
  useEffect(() => {
    if (loadedFor.current !== id || !serverDraft) return;
    const text = JSON.stringify(serverDraft);
    if (text === known.current) return;
    if (dirty.current) {
      setExternal(true);
      return;
    }
    known.current = text;
    const loaded = shown(serverDraft);
    setSpec(loaded);
    setPlanFor(loaded);
    setReport(null);
    void globalMutate(publishPlanKey(id));
  }, [serverDraft, id]);

  const check = useCallback(
    (next: SymptomSpec, save: boolean) => {
      const ticket = ++latest.current;
      // The plan describes `next` once its reload after the save resolves.
      const reloadPlan = async () => {
        await globalMutate(publishPlanKey(id));
        if (ticket === latest.current) setPlanFor(next);
      };
      const run = async () => {
        try {
          if (save) {
            setSaving(true);
            const saved = await saveDraft(id, next);
            known.current = JSON.stringify(saved?.spec ?? next);
            if (ticket === latest.current) dirty.current = false;
            setSaveError(null);
            void mutate();
            void refreshSymptoms();
            void reloadPlan();
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
      };
      queue.current = queue.current.then(run);
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
      if (canWrite) dirty.current = true;
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
    const next = shown(fresh?.draft?.spec ?? fresh?.current?.spec ?? null);
    known.current = JSON.stringify(fresh?.draft?.spec ?? null);
    dirty.current = false;
    setExternal(false);
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
    /** The draft changed elsewhere while this page has unsaved edits; resync takes the other one. */
    external,
    discard,
    resync,
  };
}
