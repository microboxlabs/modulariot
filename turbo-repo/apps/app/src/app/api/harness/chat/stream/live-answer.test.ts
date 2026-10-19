import { describe, expect, it } from "vitest";
import { chatAnswerEvents, type ChatEvent } from "./chat-answer";
import { LiveAnswer, readableAnswer } from "./live-answer";

const BLOCKS = JSON.stringify([
  {
    type: "markdown",
    value: '## Trips\nThere were **41** trips — "late" ones: 3.',
  },
  { type: "widget", value: { id: "w1" } },
  { type: "url", value: { url: "https://example.test/r", name: "Report" } },
  { type: "markdown", value: "Día con más viajes: lunes \\ fin" },
  {
    type: "choices",
    value: { question: "More?", options: [{ label: "Yes" }] },
  },
]);

const WIDGET_EVENT = {
  type: "widget.created",
  data: {
    widget: {
      id: "w1",
      kind: "kpi",
      title: "Trips",
      columns: ["n"],
      rows: [{ n: 41 }],
      y: ["n"],
    },
  },
};

const OPTS = { noAnswer: "No answer", assumptionLabel: "Assumption" };

/** Every way to cut `text` into `size`-long chunks, from every offset. */
function chunked(text: string, size: number, offset = 0): string[] {
  const chunks = [text.slice(0, offset)];
  for (let i = offset; i < text.length; i += size) {
    chunks.push(text.slice(i, i + size));
  }
  return chunks.filter(Boolean);
}

function streamed(chunks: string[]): { events: ChatEvent[]; live: LiveAnswer } {
  const events: ChatEvent[] = [];
  let n = 0;
  const live = new LiveAnswer(
    (e) => events.push(e),
    () => `m${++n}`
  );
  for (const chunk of chunks) live.push(chunk);
  return { events, live };
}

function textOf(events: ChatEvent[]): string {
  return events
    .filter((e) => e.type === "TEXT_MESSAGE_CONTENT")
    .map((e) => e.delta)
    .join("");
}

function finalText(answer: string, events: unknown[] = []): string {
  return chatAnswerEvents(answer, events, OPTS)
    .filter((e) => e.type === "TEXT_MESSAGE_CONTENT")
    .map((e) => e.delta)
    .join("\n\n");
}

describe("readableAnswer", () => {
  it("reads plain text as it is", () => {
    expect(readableAnswer("  There were 41 trips")).toBe("There were 41 trips");
  });

  it("reads the markdown of a block array still being written", () => {
    expect(readableAnswer('[{"type":"markdown","value":"There were 4')).toBe(
      "There were 4"
    );
  });

  it("leaves out a link until it is complete", () => {
    const partial =
      '[{"type":"markdown","value":"A"},{"type":"url","value":{"url":"https://exa';
    expect(readableAnswer(partial)).toBe("A");
  });

  it("returns null for text that opens with a bracket but is no block array", () => {
    expect(
      readableAnswer("[Report](https://example.test/r) is ready")
    ).toBeNull();
  });

  it("reads a whole answer as the final answer's text", () => {
    expect(readableAnswer(BLOCKS)).toBe(finalText(BLOCKS, [WIDGET_EVENT]));
  });
});

describe("LiveAnswer", () => {
  it.each([1, 2, 3, 7])(
    "streams a block answer cut every %i characters as text that only grows",
    (size) => {
      for (const offset of [0, 1, 5, 13]) {
        const { events } = streamed(chunked(BLOCKS, size, offset));
        const text = textOf(events);
        expect(text).toBe(finalText(BLOCKS, [WIDGET_EVENT]));
        expect(
          events.filter((e) => e.type === "TEXT_MESSAGE_START")
        ).toHaveLength(1);
        expect(events.every((e) => e.messageId === "m1")).toBe(true);
      }
    }
  );

  it("streams a plain answer, trailing spaces held back until more text follows", () => {
    const { events, live } = streamed([
      "There were ",
      "41",
      " trips.\n",
      "\nDone",
    ]);
    expect(events.map((e) => e.delta).filter(Boolean)).toEqual([
      "There were",
      " 41",
      " trips.",
      "\n\nDone",
    ]);
    expect(live.text).toBe("There were 41 trips.\n\nDone");
  });

  it("merges the final answer into the streamed text and sends only the cards after it", () => {
    const { events, live } = streamed(chunked(BLOCKS, 5).slice(0, 12));
    const shownBefore = textOf(events);
    expect(shownBefore.length).toBeGreaterThan(0);

    const final = chatAnswerEvents(BLOCKS, [WIDGET_EVENT], OPTS);
    expect(live.settle(final)).toBe(true);

    expect(textOf(events)).toBe(finalText(BLOCKS, [WIDGET_EVENT]));
    const starts = events.filter((e) => e.type === "TEXT_MESSAGE_START");
    expect(starts).toHaveLength(1);
    const cards = events
      .filter((e) => e.type === "TOOL_CALL_START")
      .map((e) => e.toolCallName);
    expect(cards).toEqual(["show_dashlet", "ask_user_question"]);
    const end = events.findIndex((e) => e.type === "TEXT_MESSAGE_END");
    const firstCard = events.findIndex((e) => e.type === "TOOL_CALL_START");
    expect(end).toBeLessThan(firstCard);
  });

  it("adds the assumption note the final answer ends with", () => {
    const answer = JSON.stringify([
      { type: "markdown", value: "41 trips" },
      {
        type: "assumption",
        value: { term: "trip", interpretation: "a route" },
      },
    ]);
    const { events, live } = streamed(chunked(answer, 4));
    live.settle(chatAnswerEvents(answer, [], OPTS));
    expect(textOf(events)).toBe("41 trips\n\n_Assumption: 'trip' = a route_");
  });

  it("sends the whole answer when nothing was streamed", () => {
    const { events, live } = streamed([]);
    expect(live.settle(chatAnswerEvents("41 trips", [], OPTS))).toBe(true);
    expect(textOf(events)).toBe("41 trips");
  });

  it("closes streamed text the final answer does not continue and sends the answer after it", () => {
    const { events, live } = streamed(["Something else entirely"]);
    expect(live.settle(chatAnswerEvents("41 trips", [], OPTS))).toBe(false);
    expect(events.filter((e) => e.type === "TEXT_MESSAGE_START")).toHaveLength(
      2
    );
    expect(events.filter((e) => e.type === "TEXT_MESSAGE_END")).toHaveLength(2);
  });

  it("starts a new message after a restart", () => {
    const { events, live } = streamed(["Let me check the tables first."]);
    live.restart();
    live.push("41 trips");
    live.settle(chatAnswerEvents("41 trips", [], OPTS));
    const messages = events.filter((e) => e.type === "TEXT_MESSAGE_START");
    expect(messages.map((e) => e.messageId)).toEqual(["m1", "m2"]);
    expect(
      events
        .filter(
          (e) => e.type === "TEXT_MESSAGE_CONTENT" && e.messageId === "m2"
        )
        .map((e) => e.delta)
        .join("")
    ).toBe("41 trips");
  });
});
