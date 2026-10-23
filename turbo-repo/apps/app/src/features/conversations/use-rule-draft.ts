"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  publishRule,
  refreshRules,
  saveRuleDraft,
  useConversationRule,
} from "./conversations-api";
import type { RuleFinding, RuleSpec } from "./conversations-types";
import { normalizeSpec } from "./rule-model";

const SAVE_DELAY_MS = 600;

/**
 * The rule's draft as edited on screen: it starts from the saved draft, else
 * the published spec, and is saved a moment after each change. The server's
 * findings come back with every save.
 */
export function useRuleDraft(id: string) {
  const { data: detail, error, mutate } = useConversationRule(id);
  const [spec, setSpec] = useState<RuleSpec | null>(null);
  const [findings, setFindings] = useState<RuleFinding[] | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const loadedFor = useRef<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const queued = useRef<RuleSpec | null>(null);
  const inFlight = useRef<Promise<void> | null>(null);

  useEffect(() => {
    if (!detail || loadedFor.current === detail.rule.id) return;
    loadedFor.current = detail.rule.id;
    setSpec(normalizeSpec(detail.draft?.spec ?? detail.current?.spec));
  }, [detail]);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    []
  );

  const save = useCallback(
    async (next: RuleSpec) => {
      setSaving(true);
      setSaveError(null);
      const work = (async () => {
        try {
          const result = await saveRuleDraft(id, next);
          setFindings(result.findings ?? []);
          await mutate(
            (current) =>
              current ? { ...current, draft: result.draft } : current,
            { revalidate: false }
          );
        } catch (e) {
          setSaveError(e instanceof Error ? e.message : String(e));
        } finally {
          setSaving(false);
        }
      })();
      inFlight.current = work;
      await work;
    },
    [id, mutate]
  );

  const update = useCallback(
    (next: RuleSpec) => {
      setSpec(next);
      queued.current = next;
      setSaving(true);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        timer.current = null;
        const toSave = queued.current;
        queued.current = null;
        if (toSave) void save(toSave);
      }, SAVE_DELAY_MS);
    },
    [save]
  );

  /** Saves a pending change now and waits for the save in progress. */
  const flush = useCallback(async () => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    const toSave = queued.current;
    queued.current = null;
    if (toSave) await save(toSave);
    else if (inFlight.current) await inFlight.current;
  }, [save]);

  const publish = useCallback(
    async (reason: string) => {
      await flush();
      await publishRule(id, reason);
      await refreshRules(id);
    },
    [flush, id]
  );

  return {
    detail,
    error,
    spec,
    findings,
    saving,
    saveError,
    update,
    flush,
    publish,
    mutate,
  };
}
