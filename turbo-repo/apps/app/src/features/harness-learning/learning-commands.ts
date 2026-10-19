import type { TrFn } from "@/features/harness-chat/context/harness-chat-i18n-context";
import type { HarnessSkill } from "@/features/harness-chat/harness-chat-types";

/** A learning session's commands, as the harness parses them, in menu order. */
const COMMANDS = [
  { id: "fact", key: "fact" },
  { id: "rule", key: "rule" },
  { id: "skill", key: "skill" },
  { id: "primer", key: "primer" },
  { id: "forget", key: "forget" },
  { id: "eval", key: "eval" },
  { id: "test", key: "test" },
  { id: "review", key: "review" },
  { id: "skill-creator", key: "skillCreator" },
  { id: "skill-doctor", key: "skillDoctor" },
  { id: "layers", key: "layers" },
  { id: "diff", key: "diff" },
] as const;

export const LEARNING_COMMAND_IDS: readonly string[] = COMMANDS.map(
  (c) => c.id
);

/** The composer's "/" menu in a learning session, then the given skills. */
export function learningCommands(
  tr: TrFn,
  skills: HarnessSkill[] = []
): HarnessSkill[] {
  const commands: HarnessSkill[] = COMMANDS.map(({ id, key }) => {
    const usage = tr(`harnessChat.learning.commands.${key}.usage`);
    return {
      id,
      label: id,
      description: tr(`harnessChat.learning.commands.${key}.description`),
      // An empty string in the dictionary comes back as its own key.
      ...(usage && !usage.startsWith("harnessChat.") ? { usage } : {}),
    };
  });
  const ids = new Set(LEARNING_COMMAND_IDS);
  return [...commands, ...skills.filter((skill) => !ids.has(skill.id))];
}
