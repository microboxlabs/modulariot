import { notFound } from "next/navigation";
import { getDictionary } from "@/features/i18n/i18n.service";
import type { ParamsWithLang } from "@/features/i18n/i18n.service.types";
import { isHarnessUiEnabled } from "@/features/layout/utils/utils";
import LearningWorkspace from "@/features/harness-learning/learning-workspace";

/** Trainers teach the assistant here; the workspace checks the permission. */
export default async function HarnessLearningPage({ params }: ParamsWithLang) {
  if (!isHarnessUiEnabled()) notFound();
  const { lang } = await params;
  const [, dictionary] = await getDictionary(lang);
  return (
    <div className="flex h-full w-full flex-col">
      <LearningWorkspace dict={dictionary} locale={lang} />
    </div>
  );
}
