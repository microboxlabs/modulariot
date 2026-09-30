import type { TrFn } from "./context/harness-chat-i18n-context";
import type { HarnessSkill } from "./harness-chat-types";

/**
 * The composer's "/" menu: the commands the harness answers itself, then the
 * skills. The harness never reads `/compact` or `/context` as a skill id, so a
 * skill with either id is left out.
 */
export function withBuiltinCommands(
  skills: HarnessSkill[],
  tr: TrFn
): HarnessSkill[] {
  const commands: HarnessSkill[] = [
    {
      id: "compact",
      label: "compact",
      description: tr("harnessChat.ui.composer.commands.compact.description"),
    },
    {
      id: "context",
      label: "context",
      description: tr("harnessChat.ui.composer.commands.context.description"),
    },
  ];
  const ids = new Set(commands.map((command) => command.id));
  return [...commands, ...skills.filter((skill) => !ids.has(skill.id))];
}
