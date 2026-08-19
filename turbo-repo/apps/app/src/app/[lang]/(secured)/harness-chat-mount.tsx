"use client";

import HarnessChat from "@/features/harness-chat/harness-chat";
import { useHarnessSkills } from "@/features/harness-chat/hooks/use-harness-skills";
import type { I18nDictionary } from "@/features/i18n/i18n.service.types";

export default function HarnessChatMount({
  dict,
  locale,
}: Readonly<{ dict: I18nDictionary; locale: string }>) {
  const skills = useHarnessSkills();
  return <HarnessChat skills={skills} dict={dict} locale={locale} />;
}
