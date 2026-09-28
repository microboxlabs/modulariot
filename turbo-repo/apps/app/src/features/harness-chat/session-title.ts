/** The parts of an assistant-ui message the title logic reads. */
export type TitleSourceMessage = {
  role: string;
  content: readonly { type: string; text?: string }[];
  status?: { type: string };
};

export type FirstExchange = { message: string; answer: string };

function textOf(message: TitleSourceMessage | undefined): string {
  return (message?.content ?? [])
    .filter((part) => part.type === "text" && typeof part.text === "string")
    .map((part) => part.text)
    .join("\n")
    .trim();
}

/** The placeholder title a thread carries until a better one exists: the text
 * of its first user message. */
export function firstMessageTitle(
  messages: readonly TitleSourceMessage[]
): string | null {
  const text = textOf(messages.find((m) => m.role === "user"));
  return text || null;
}

/** The question and answer of a thread whose first answer has just completed;
 * null for anything else, including a thread already past its first turn. */
export function firstExchange(
  messages: readonly TitleSourceMessage[]
): FirstExchange | null {
  const users = messages.filter((m) => m.role === "user");
  const assistants = messages.filter((m) => m.role === "assistant");
  if (users.length !== 1 || assistants.length !== 1) return null;
  if (assistants[0].status?.type !== "complete") return null;
  const message = textOf(users[0]);
  const answer = textOf(assistants[0]);
  return message && answer ? { message, answer } : null;
}

/** The exchange to title a thread from, once a run has finished its first
 * answer. Only a run this panel saw start counts: a thread opened from history
 * already holds its first exchange and must not be retitled on load. */
export function exchangeToTitle(
  sawRun: boolean,
  isRunning: boolean,
  messages: readonly TitleSourceMessage[]
): FirstExchange | null {
  return sawRun && !isRunning ? firstExchange(messages) : null;
}
