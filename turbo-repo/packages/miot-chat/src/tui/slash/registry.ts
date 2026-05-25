import type { SessionAction, TranscriptItem } from "../session/types.js";

export interface SlashArgSpec {
  name: string;
  required: boolean;
  choices?: readonly string[];
}

export type ModalKind =
  | "context"
  | "approval"
  | "resume"
  | "theme"
  | "runs";

export interface ModalSpec {
  kind: ModalKind;
  payload?: Record<string, unknown>;
}

// Bag of services and refs handlers can pull from. The registry doesn't
// care what's on it; concrete fields are added by the caller wiring T10+
// handlers (client, config, etc.). Defined as a Record-extended interface
// so the runtime SlashContext can carry arbitrary keys without
// disclaimers.
export type SlashContext = Record<string, unknown>;

export interface SlashResult {
  dispatch?: SessionAction;
  output?: TranscriptItem;
  modal?: ModalSpec;
  abort?: boolean;
  error?: string;
}

export interface SlashCommand {
  name: string;
  summary: string;
  usage: string;
  argSchema?: readonly SlashArgSpec[];
  handle(args: string[], ctx: SlashContext): Promise<SlashResult> | SlashResult;
}

export class SlashRegistry {
  private readonly commands: Map<string, SlashCommand> = new Map();

  register(cmd: SlashCommand): this {
    this.commands.set(cmd.name, cmd);
    return this;
  }

  has(name: string): boolean {
    return this.commands.has(name);
  }

  get(name: string): SlashCommand | undefined {
    return this.commands.get(name);
  }

  all(): SlashCommand[] {
    return [...this.commands.values()].sort((a, b) =>
      a.name.localeCompare(b.name),
    );
  }

  /**
   * Substring-match across command names AND summaries.
   * Empty prefix returns all commands.
   * Matches in the name field are ranked above matches in the summary.
   */
  findMatches(prefix: string): SlashCommand[] {
    const q = prefix.toLowerCase();
    if (q.length === 0) return this.all();
    const nameHits: SlashCommand[] = [];
    const summaryHits: SlashCommand[] = [];
    for (const cmd of this.all()) {
      if (cmd.name.toLowerCase().includes(q)) nameHits.push(cmd);
      else if (cmd.summary.toLowerCase().includes(q)) summaryHits.push(cmd);
    }
    return [...nameHits, ...summaryHits];
  }

  /**
   * Tab-completion target: returns the unique match's name when there is
   * exactly one, otherwise null. The palette uses this to decide whether
   * Tab should auto-complete or just keep the dropdown open.
   */
  tabCompletion(prefix: string): string | null {
    const matches = this.findMatches(prefix);
    return matches.length === 1 && matches[0] ? matches[0].name : null;
  }
}
