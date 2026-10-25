"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  discardRuleDraft,
  publishRule,
  refreshRules,
  saveRuleDraft,
  useConversationRule,
} from "./conversations-api";
import type { RuleBump, RuleFinding, RuleSpec } from "./conversations-types";
import { normalizeSpec } from "./rule-model";

const SAVE_DELAY_MS = 600;

/**
 * The rule's draft as edited on screen: it starts from the saved draft, else
 * the published spec, and is saved a moment after each change. The server's
 * findings come with the saved draft and back with every save.
 *
 * Saves run one at a time, in the order of the edits, so an older save never
 * lands after a newer one. The latest edit stays pending until a save of it
 * succeeds; {@link flush} retries it and rejects while it is not saved.
 */
export function useRuleDraft(id: string) {
  const { data: detail, error, mutate } = useConversationRule(id);
  const [spec, setSpec] = useState<RuleSpec | null>(null);
  const [findings, setFindings] = useState<RuleFinding[] | null>(null);
  const [saving, setSaving] = useState(false);
  const [discarding, setDiscarding] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const loadedFor = useRef<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** The latest edit not saved yet. */
  const pending = useRef<RuleSpec | null>(null);
  const discardInProgress = useRef(false);
  /** The saves queued so far; it never rejects. */
  const chain = useRef<Promise<void>>(Promise.resolve());
  const running = useRef(0);
  const lastError = useRef<string | null>(null);

  useEffect(() => {
    if (!detail || loadedFor.current === detail.rule.id) return;
    loadedFor.current = detail.rule.id;
    setSpec(normalizeSpec(detail.draft?.spec ?? detail.current?.spec));
    setFindings(detail.findings ?? null);
  }, [detail]);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    []
  );

  const persist = useCallback(
    async (next: RuleSpec) => {
      try {
        const result = await saveRuleDraft(id, next);
        if (pending.current === next) pending.current = null;
        lastError.current = null;
        setSaveError(null);
        setFindings(result.findings ?? []);
        await mutate(
          (current) =>
            current ? { ...current, draft: result.draft } : current,
          { revalidate: false }
        );
      } catch (e) {
        lastError.current = e instanceof Error ? e.message : String(e);
        setSaveError(lastError.current);
      }
    },
    [id, mutate]
  );

  const enqueue = useCallback(
    (next: RuleSpec) => {
      running.current += 1;
      setSaving(true);
      chain.current = chain.current
        .then(() => persist(next))
        .finally(() => {
          running.current -= 1;
          if (running.current === 0 && !timer.current) setSaving(false);
        });
      return chain.current;
    },
    [persist]
  );

  const update = useCallback(
    (next: RuleSpec) => {
      if (discardInProgress.current) return;
      setSpec(next);
      pending.current = next;
      setSaving(true);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        timer.current = null;
        if (pending.current) void enqueue(pending.current);
      }, SAVE_DELAY_MS);
    },
    [enqueue]
  );

  /**
   * Saves the pending edit now, after the saves before it, and retries an
   * edit whose save failed. Rejects when the latest edit is still not saved.
   */
  const flush = useCallback(async () => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    await chain.current;
    if (pending.current) await enqueue(pending.current);
    if (pending.current) {
      throw new Error(lastError.current ?? "The draft was not saved");
    }
  }, [enqueue]);

  const publish = useCallback(
    async (reason: string, bump: RuleBump | null = null) => {
      await flush();
      await publishRule(id, reason, bump);
      await refreshRules(id);
    },
    [flush, id]
  );

  /** Drops the draft, after any save in flight, and goes back to the version in force. */
  const discard = useCallback(async () => {
    if (discardInProgress.current) return;
    discardInProgress.current = true;
    setDiscarding(true);
    const unsaved = pending.current;
    try {
      if (timer.current) {
        clearTimeout(timer.current);
        timer.current = null;
      }
      pending.current = null;
      await chain.current;
      try {
        await discardRuleDraft(id);
      } catch (e) {
        if (unsaved) {
          pending.current = unsaved;
          void enqueue(unsaved);
        }
        throw e;
      }
      setSaveError(null);
      setFindings(null);
      setSaving(false);
      setSpec(normalizeSpec(detail?.current?.spec));
      await mutate(
        (current) => (current ? { ...current, draft: null } : current),
        { revalidate: false }
      );
      const fresh = await mutate();
      setSpec(normalizeSpec(fresh?.current?.spec ?? detail?.current?.spec));
      await refreshRules(id);
    } finally {
      discardInProgress.current = false;
      setDiscarding(false);
    }
  }, [detail, enqueue, id, mutate]);

  return {
    detail,
    error,
    spec,
    findings,
    saving,
    discarding,
    saveError,
    update,
    flush,
    publish,
    discard,
    mutate,
  };
}
