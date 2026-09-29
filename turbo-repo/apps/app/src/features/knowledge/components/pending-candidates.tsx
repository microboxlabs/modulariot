"use client";

import { useState } from "react";
import {
  Alert,
  Badge,
  Button,
  Label,
  Textarea,
  TextInput,
} from "flowbite-react";
import { HiCheck, HiPencil, HiX } from "react-icons/hi";
import { toast } from "sonner";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import { useKnowledgeCandidates } from "../hooks/use-knowledge-candidates";
import type { KnowledgeCandidate } from "../types";

interface Draft {
  id: string;
  term: string;
  body: string;
}

/**
 * Pending candidates. Trainers approve, edit or reject them; everyone else sees
 * the queue read-only.
 */
export default function PendingCandidates({
  kn,
  isTrainer,
  onApplied,
}: Readonly<{ kn: I18nRecord; isTrainer: boolean; onApplied: () => void }>) {
  const { candidates, isLoading, error, reviewing, review, edit, refetch } =
    useKnowledgeCandidates();
  const [draft, setDraft] = useState<Draft | null>(null);

  async function handleReview(
    c: KnowledgeCandidate,
    decision: "approve" | "reject"
  ) {
    const term = c.term;
    try {
      const result = await review(c.id, decision);
      if (decision === "reject") {
        toast.success(tr("toast.rejected", kn, { term }));
      } else if (result.cardApplied === false) {
        toast.warning(tr("toast.approvedNotApplied", kn, { term }));
      } else {
        toast.success(tr("toast.approved", kn, { term }));
        onApplied();
      }
    } catch {
      toast.error(tr("toast.reviewError", kn));
    }
  }

  async function handleSave() {
    if (!draft) return;
    const term = draft.term.trim();
    const body = draft.body.trim();
    if (!term || !body) return;
    try {
      await edit(draft.id, { term, body });
      toast.success(tr("toast.edited", kn, { term }));
      setDraft(null);
    } catch {
      toast.error(tr("toast.editError", kn));
    }
  }

  return (
    <section>
      <h3 className="text-lg font-semibold dark:text-white">
        {tr("pendingTitle", kn)}
      </h3>
      {!isTrainer && (
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {tr("readOnly", kn)}
        </p>
      )}

      {isLoading && (
        <div className="flex justify-center py-8">
          <div className="h-6 w-6 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
        </div>
      )}

      {!isLoading && error && (
        <Alert color="failure">
          <div className="flex items-center justify-between">
            <span>{tr("error", kn)}</span>
            <Button size="xs" color="failure" onClick={() => refetch()}>
              {tr("retry", kn)}
            </Button>
          </div>
        </Alert>
      )}

      {!isLoading && !error && candidates.length === 0 && (
        <p className="py-4 text-sm text-gray-500 dark:text-gray-400">
          {tr("empty", kn)}
        </p>
      )}

      {!isLoading && !error && candidates.length > 0 && (
        <ul className="divide-y divide-gray-200 dark:divide-gray-700">
          {candidates.map((c) =>
            draft?.id === c.id ? (
              <li key={c.id} className="flex flex-col gap-2 py-3">
                <Label htmlFor={`term-${c.id}`}>{tr("termLabel", kn)}</Label>
                <TextInput
                  id={`term-${c.id}`}
                  sizing="sm"
                  value={draft.term}
                  onChange={(e) => setDraft({ ...draft, term: e.target.value })}
                />
                <Label htmlFor={`body-${c.id}`}>{tr("bodyLabel", kn)}</Label>
                <Textarea
                  id={`body-${c.id}`}
                  rows={3}
                  value={draft.body}
                  onChange={(e) => setDraft({ ...draft, body: e.target.value })}
                />
                <div className="flex justify-end gap-2">
                  <Button
                    size="xs"
                    color="light"
                    onClick={() => setDraft(null)}
                  >
                    {tr("cancel", kn)}
                  </Button>
                  <Button
                    size="xs"
                    disabled={
                      reviewing === c.id ||
                      !draft.term.trim() ||
                      !draft.body.trim()
                    }
                    onClick={handleSave}
                  >
                    {tr("save", kn)}
                  </Button>
                </div>
              </li>
            ) : (
              <li
                key={c.id}
                className="flex items-start justify-between gap-4 py-3"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold dark:text-white">
                      {c.term}
                    </span>
                    <Badge color="gray">{c.connection}</Badge>
                    <Badge color="purple">{c.scope}</Badge>
                    {c.kind && <Badge color="blue">{c.kind}</Badge>}
                  </div>
                  <p className="mt-1 break-words text-sm text-gray-600 dark:text-gray-300">
                    {c.body}
                  </p>
                </div>
                {isTrainer && (
                  <div className="flex shrink-0 items-center gap-2">
                    <Button
                      size="xs"
                      color="light"
                      disabled={reviewing === c.id}
                      onClick={() => handleReview(c, "reject")}
                    >
                      <HiX className="mr-1 h-4 w-4" />
                      {tr("reject", kn)}
                    </Button>
                    <Button
                      size="xs"
                      color="light"
                      disabled={reviewing === c.id}
                      onClick={() =>
                        setDraft({ id: c.id, term: c.term, body: c.body })
                      }
                    >
                      <HiPencil className="mr-1 h-4 w-4" />
                      {tr("edit", kn)}
                    </Button>
                    <Button
                      size="xs"
                      disabled={reviewing === c.id}
                      onClick={() => handleReview(c, "approve")}
                    >
                      <HiCheck className="mr-1 h-4 w-4" />
                      {tr("approve", kn)}
                    </Button>
                  </div>
                )}
              </li>
            )
          )}
        </ul>
      )}
    </section>
  );
}
