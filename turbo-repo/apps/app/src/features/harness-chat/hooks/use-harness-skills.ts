"use client";

import useSWR from "swr";
import type { HarnessSkill } from "../harness-chat-types";

/** Mirrors the harness client's `SkillSummary` (GET /skills) — see
 * @microboxlabs/miot-harness-client's skills resource. */
interface HarnessSkillSummary {
  id: string;
  name: string;
  description: string;
  when_to_use: string;
  scope: "global" | "tenant";
  source: "skill_md" | "manifest";
}

const fetcher = async (url: string): Promise<HarnessSkillSummary[]> => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch skills: ${res.status}`);
  const body = (await res.json()) as { skills: HarnessSkillSummary[] };
  return body.skills;
};

/**
 * The real skills the harness exposes, via /api/harness/skills (which
 * relays `client.skills.list()` — the same call the harness CLI and TUI
 * use), mapped to the composer's slash-command shape.
 */
export function useHarnessSkills(): HarnessSkill[] {
  const { data } = useSWR(
    `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/harness/skills`,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 60_000 },
  );

  return (data ?? []).map((skill) => ({
    id: skill.id,
    label: skill.name,
    description: skill.description,
  }));
}
