"use client";

import HarnessChat from "@/features/harness-chat/harness-chat";
import { useHarnessSkills } from "@/features/harness-chat/hooks/use-harness-skills";

export default function HarnessChatMount() {
  const skills = useHarnessSkills();
  return <HarnessChat skills={skills} />;
}
