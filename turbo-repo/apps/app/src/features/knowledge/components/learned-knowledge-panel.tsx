"use client";

import { Alert, Badge, Button, Card } from "flowbite-react";
import { HiCheck, HiOutlineLightBulb, HiX } from "react-icons/hi";
import { toast } from "sonner";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import { useKnowledgeCandidates } from "../hooks/use-knowledge-candidates";

/**
 * The human gate, in the UI: lists the business-semantics facts the harness
 * learned from real sessions and lets a reviewer approve (→ written as a
 * connection card the next run grounds on) or reject them. Rendered as a peer
 * panel on the data-sources settings page.
 */
export default function LearnedKnowledgePanel({
  dict,
}: Readonly<{ dict: I18nRecord }>) {
  const kn = dict?.learnedKnowledge as I18nRecord;
  const { candidates, isLoading, error, reviewing, review, refetch } =
    useKnowledgeCandidates();

  async function handleReview(
    id: string,
    decision: "approve" | "reject",
    term: string,
  ) {
    try {
      const result = await review(id, decision);
      if (decision === "reject") {
        toast.success(tr("toast.rejected", kn, { term }));
      } else if (result.cardApplied === false) {
        toast.warning(tr("toast.approvedNotApplied", kn, { term }));
      } else {
        toast.success(tr("toast.approved", kn, { term }));
      }
    } catch {
      toast.error(tr("toast.reviewError", kn));
    }
  }

  return (
    <Card className="mt-6">
      <div className="flex items-center gap-2">
        <HiOutlineLightBulb className="h-5 w-5 text-yellow-400" />
        <h2 className="text-xl font-bold dark:text-white">{tr("title", kn)}</h2>
      </div>
      <p className="-mt-2 text-sm text-gray-500 dark:text-gray-400">
        {tr("description", kn)}
      </p>

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
          {candidates.map((c) => (
            <li
              key={c.id}
              className="flex items-start justify-between gap-4 py-3"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold dark:text-white">{c.term}</span>
                  <Badge color="gray">{c.connection}</Badge>
                  <Badge color="purple">{c.scope}</Badge>
                  {c.kind && <Badge color="blue">{c.kind}</Badge>}
                </div>
                <p className="mt-1 break-words text-sm text-gray-600 dark:text-gray-300">
                  {c.body}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Button
                  size="xs"
                  color="light"
                  disabled={reviewing === c.id}
                  onClick={() => handleReview(c.id, "reject", c.term)}
                >
                  <HiX className="mr-1 h-4 w-4" />
                  {tr("reject", kn)}
                </Button>
                <Button
                  size="xs"
                  disabled={reviewing === c.id}
                  onClick={() => handleReview(c.id, "approve", c.term)}
                >
                  <HiCheck className="mr-1 h-4 w-4" />
                  {tr("approve", kn)}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
