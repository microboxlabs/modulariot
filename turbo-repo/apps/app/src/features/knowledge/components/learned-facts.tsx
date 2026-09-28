"use client";

import { useState } from "react";
import { Alert, Badge, Button } from "flowbite-react";
import { HiTrash } from "react-icons/hi";
import { toast } from "sonner";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import type { ConnectionCards, KnowledgeCard } from "../types";

/**
 * Approved cards per connection. Trainers can delete a card after a second
 * click to confirm; non-trainers only see a note, since listing cards requires
 * the trainer permission.
 */
export default function LearnedFacts({
  kn,
  isTrainer,
  connections,
  isLoading,
  error,
  deleting,
  remove,
  refetch,
}: Readonly<{
  kn: I18nRecord;
  isTrainer: boolean;
  connections: ConnectionCards[];
  isLoading: boolean;
  error: unknown;
  deleting: string | null;
  remove: (connection: string, cardId: string) => Promise<void>;
  refetch: () => void;
}>) {
  const [confirming, setConfirming] = useState<string | null>(null);

  async function handleDelete(connection: string, card: KnowledgeCard) {
    if (confirming !== card.id) {
      setConfirming(card.id);
      return;
    }
    const term = card.term ?? card.title ?? card.id;
    try {
      await remove(connection, card.id);
      toast.success(tr("toast.deleted", kn, { term }));
    } catch {
      toast.error(tr("toast.deleteError", kn));
    } finally {
      setConfirming(null);
    }
  }

  const withCards = connections.filter((c) => c.cards.length > 0 || c.error);

  return (
    <section>
      <h3 className="text-lg font-semibold dark:text-white">
        {tr("factsTitle", kn)}
      </h3>
      <p className="text-sm text-gray-500 dark:text-gray-400">
        {tr("factsDescription", kn)}
      </p>

      {!isTrainer && (
        <p className="py-4 text-sm text-gray-500 dark:text-gray-400">
          {tr("factsReadOnly", kn)}
        </p>
      )}

      {isTrainer && isLoading && (
        <div className="flex justify-center py-8">
          <div className="h-6 w-6 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
        </div>
      )}

      {isTrainer && !isLoading && Boolean(error) && (
        <Alert color="failure">
          <div className="flex items-center justify-between">
            <span>{tr("factsError", kn)}</span>
            <Button size="xs" color="failure" onClick={() => refetch()}>
              {tr("retry", kn)}
            </Button>
          </div>
        </Alert>
      )}

      {isTrainer && !isLoading && !error && withCards.length === 0 && (
        <p className="py-4 text-sm text-gray-500 dark:text-gray-400">
          {tr("factsEmpty", kn)}
        </p>
      )}

      {isTrainer &&
        !isLoading &&
        !error &&
        withCards.map((group) => (
          <div key={group.connection} className="mt-3">
            <Badge color="gray" className="w-fit">
              {group.connection}
            </Badge>
            {group.error && (
              <p className="py-2 text-sm text-red-600 dark:text-red-400">
                {tr("factsConnectionError", kn)}
              </p>
            )}
            <ul className="divide-y divide-gray-200 dark:divide-gray-700">
              {group.cards.map((card) => (
                <li
                  key={card.id}
                  className="flex items-start justify-between gap-4 py-3"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold dark:text-white">
                        {card.term ?? card.title ?? card.id}
                      </span>
                      {card.scope && <Badge color="purple">{card.scope}</Badge>}
                      {card.kind && <Badge color="blue">{card.kind}</Badge>}
                    </div>
                    <p className="mt-1 break-words text-sm text-gray-600 dark:text-gray-300">
                      {card.body}
                    </p>
                  </div>
                  <Button
                    size="xs"
                    color={confirming === card.id ? "failure" : "light"}
                    disabled={deleting === card.id}
                    onClick={() => handleDelete(group.connection, card)}
                  >
                    <HiTrash className="mr-1 h-4 w-4" />
                    {confirming === card.id
                      ? tr("confirmDelete", kn)
                      : tr("delete", kn)}
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        ))}
    </section>
  );
}
