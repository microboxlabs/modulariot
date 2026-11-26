"use client";

import { Card } from "flowbite-react";
import { HiOutlineLightBulb } from "react-icons/hi";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import { useKnowledgeCards } from "../hooks/use-knowledge-cards";
import { useKnowledgeTrainer } from "../hooks/use-knowledge-trainer";
import LearnedFacts from "./learned-facts";
import PendingCandidates from "./pending-candidates";
import HeaderIconTile from "@/features/common/components/header-icon-tile";

/**
 * What the chat agent learned: facts pending review and the approved facts it
 * already uses. Trainers review, edit and delete; other members read. Rendered
 * as a peer panel on the data-sources settings page.
 */
export default function LearnedKnowledgePanel({
  dict,
}: Readonly<{ dict: I18nRecord }>) {
  const kn = dict?.learnedKnowledge as I18nRecord;
  const { isTrainer } = useKnowledgeTrainer();
  const cards = useKnowledgeCards(isTrainer);

  return (
    <Card className="mt-6">
      <div className="flex items-center gap-4">
        <HeaderIconTile
          icon={HiOutlineLightBulb}
          iconClassName="text-yellow-500"
        />
        <div>
          <h2 className="text-xl font-bold dark:text-white">
            {tr("title", kn)}
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {tr("description", kn)}
          </p>
        </div>
      </div>

      <PendingCandidates
        kn={kn}
        isTrainer={isTrainer}
        onApplied={cards.refetch}
      />
      <LearnedFacts kn={kn} isTrainer={isTrainer} {...cards} />
    </Card>
  );
}
