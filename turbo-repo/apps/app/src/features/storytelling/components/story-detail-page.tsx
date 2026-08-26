"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { HiArrowLeft, HiSparkles } from "react-icons/hi2";
import { ClientBreadcrumb } from "@/features/common/components/Breadcrumb/ClientBreadcrumb";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import { getStory } from "../storytelling-store";
import StoryDashletList from "./story-dashlet-list";

interface StoryDetailPageProps {
  readonly dict: I18nRecord;
  readonly id: string;
}

export default function StoryDetailPage({ dict, id }: StoryDetailPageProps) {
  const { lang } = useParams<{ lang: string }>();
  // Looked up once on mount: the store is localStorage-backed, so a fresh
  // page load is the only time it can have changed since this route rendered.
  const [story] = useState(() => getStory(id));

  if (!story) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-3 p-6 text-center">
        <p className="text-lg font-semibold text-gray-900 dark:text-white">
          {tr("detail.notFound.title", dict)}
        </p>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {tr("detail.notFound.description", dict)}
        </p>
        <Link
          href={`/${lang}/storytelling`}
          className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:underline dark:text-blue-400"
        >
          <HiArrowLeft className="h-4 w-4" />
          {tr("detail.notFound.backButton", dict)}
        </Link>
      </div>
    );
  }

  return (
    <div className="flex h-full w-full flex-col">
      <div className="flex w-full items-center justify-between border-b border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-900">
        <ClientBreadcrumb
          dict={(dict?.breadcrumb as I18nRecord) ?? {}}
          rootIcon={<HiSparkles className="mr-2 h-4 w-4" />}
          path={[
            { label: "storytelling", href: "/storytelling" },
            { label: story.title },
          ]}
          rightContent={
            story.source === "ai"
              ? [
                  {
                    key: "ai-badge",
                    content: (
                      <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-violet-100 px-2 py-0.5 text-xs font-medium text-violet-700 dark:bg-violet-900/30 dark:text-violet-400">
                        <HiSparkles className="h-3 w-3" />
                        {tr("detail.aiGeneratedBadge", dict)}
                      </span>
                    ),
                  },
                ]
              : []
          }
        />
      </div>

      <div className="mx-auto w-full max-w-screen-2xl flex-1 p-5">
        <StoryDashletList />
      </div>
    </div>
  );
}
