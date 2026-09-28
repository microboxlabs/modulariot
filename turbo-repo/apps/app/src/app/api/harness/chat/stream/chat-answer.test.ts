import { describe, expect, it } from "vitest";

import {
  answerFromToolResult,
  chatAnswerEvents,
  humanize,
  parseChatBlocks,
  widgetToDashlet,
  widgetsOf,
  type WidgetSpec,
} from "./chat-answer";

const barWidget = {
  id: "w1",
  kind: "bar",
  title: "Horas por transportista",
  x: "carrier",
  y: ["driving_hours"],
  unit: "h",
  columns: ["carrier", "driving_hours"],
  rows: [
    { carrier: "Cordillera", driving_hours: "4983.1" },
    { carrier: "Altiplano", driving_hours: 4490.1 },
  ],
};

const runEvents = [
  { type: "tool.started", data: { tool: "fleet_show" } },
  { type: "widget.created", data: { widget: barWidget } },
];

function counter(): () => string {
  let n = 0;
  return () => `id${++n}`;
}

const opts = {
  noAnswer: "No answer",
  assumptionLabel: "Supuesto",
  newId: counter(),
};

describe("parseChatBlocks", () => {
  it("keeps the chat block types and drops unknown or unsafe ones", () => {
    const answer = JSON.stringify([
      { type: "intent", value: "ask" },
      { type: "markdown", value: "Hola" },
      { type: "url", value: { url: "javascript:alert(1)", name: "x" } },
      { type: "widget", value: { id: "w1" } },
      {
        type: "choices",
        value: { question: "¿Cuál?", options: [{ label: "A" }] },
      },
    ]);
    expect(parseChatBlocks(answer).map((b) => b.type)).toEqual([
      "markdown",
      "widget",
      "choices",
    ]);
  });

  it("treats a non-JSON answer as markdown", () => {
    expect(parseChatBlocks("plain")).toEqual([
      { type: "markdown", value: "plain" },
    ]);
  });
});

describe("widgetToDashlet", () => {
  const [spec] = widgetsOf(runEvents) as [WidgetSpec];

  it("maps a bar widget to a static chart_v2 with string rows", () => {
    const { dashletId, config } = widgetToDashlet(spec);
    expect(dashletId).toBe("chart_v2");
    expect(config).toMatchObject({
      dataMode: "static",
      chartFamily: "cartesian",
      xAxisColumn: "carrier",
      representations: [
        { columnKey: "driving_hours", label: "Driving hours (h)", type: "bar" },
      ],
      rows: [
        { carrier: "Cordillera", driving_hours: "4983.1" },
        { carrier: "Altiplano", driving_hours: "4490.1" },
      ],
    });
  });

  it("maps a kpi to stat_icon over the first row", () => {
    const { dashletId, config } = widgetToDashlet({ ...spec, kind: "kpi" });
    expect(dashletId).toBe("stat_icon");
    expect(config.value).toBe("{{row.driving_hours}}");
    expect(JSON.parse(String(config.staticData))).toEqual({
      carrier: "Cordillera",
      driving_hours: "4983.1",
    });
  });

  it("maps a table to data_table_v2 with sortable, labelled columns", () => {
    const { dashletId, config } = widgetToDashlet({ ...spec, kind: "table" });
    expect(dashletId).toBe("data_table_v2");
    expect(config.columns).toEqual([
      { key: "{{row.carrier}}", label: "Carrier", type: "text" },
      {
        key: "{{row.driving_hours}}",
        label: "Driving hours",
        type: "highlight",
      },
    ]);
    expect(config.sort).toEqual({
      enabled: true,
      columns: ["{{row.carrier}}", "{{row.driving_hours}}"],
    });
  });

  it("maps a pie to the pie chart family", () => {
    expect(widgetToDashlet({ ...spec, kind: "pie" }).config.chartFamily).toBe(
      "pie"
    );
  });
});

describe("chatAnswerEvents", () => {
  const types = (events: Record<string, unknown>[]) =>
    events.map((e) => `${e.type}${e.toolCallName ? `:${e.toolCallName}` : ""}`);

  it("places each widget where its block sits", () => {
    const answer = JSON.stringify([
      { type: "intent", value: "ask" },
      { type: "markdown", value: "Antes" },
      { type: "widget", value: { id: "w1" } },
      { type: "markdown", value: "Después" },
    ]);
    const events = chatAnswerEvents(answer, runEvents, {
      ...opts,
      newId: counter(),
    });
    expect(types(events)).toEqual([
      "TEXT_MESSAGE_START",
      "TEXT_MESSAGE_CONTENT",
      "TEXT_MESSAGE_END",
      "TOOL_CALL_START:show_dashlet",
      "TOOL_CALL_ARGS",
      "TOOL_CALL_END",
      "TEXT_MESSAGE_START",
      "TEXT_MESSAGE_CONTENT",
      "TEXT_MESSAGE_END",
    ]);
  });

  it("appends widgets the answer never placed and ends with the choices card", () => {
    const answer = JSON.stringify([
      { type: "markdown", value: "Hay dos definiciones posibles." },
      {
        type: "choices",
        value: {
          question: "¿Cuál usar?",
          options: [{ label: "A" }, { label: "B" }],
        },
      },
    ]);
    const events = chatAnswerEvents(answer, runEvents, {
      ...opts,
      newId: counter(),
    });
    expect(
      types(events).filter((t) => t.startsWith("TOOL_CALL_START"))
    ).toEqual([
      "TOOL_CALL_START:show_dashlet",
      "TOOL_CALL_START:ask_user_question",
    ]);
  });

  it("adds assumptions as a closing note", () => {
    const answer = JSON.stringify([
      { type: "markdown", value: "Respuesta" },
      {
        type: "assumption",
        value: { term: "entregas", interpretation: "pedidos cerrados" },
      },
    ]);
    const events = chatAnswerEvents(answer, [], { ...opts, newId: counter() });
    expect(events[1]?.delta).toBe(
      "Respuesta\n\n_Supuesto: 'entregas' = pedidos cerrados_"
    );
  });

  it("says there is no answer when nothing renders", () => {
    const events = chatAnswerEvents(null, [], { ...opts, newId: counter() });
    expect(events[1]?.delta).toBe("No answer");
  });
});

describe("answerFromToolResult", () => {
  const askCall = {
    role: "assistant",
    toolCalls: [
      {
        id: "tc1",
        type: "function",
        function: {
          name: "ask_user_question",
          arguments: JSON.stringify({ question: "¿Qué horas?" }),
        },
      },
      {
        id: "tc2",
        type: "function",
        function: { name: "show_dashlet", arguments: "{}" },
      },
    ],
  };

  it("turns a picked option into the next user message", () => {
    const messages = [
      askCall,
      {
        role: "tool",
        toolCallId: "tc1",
        content: JSON.stringify({ selected: ["En movimiento"], other: "" }),
      },
    ];
    expect(answerFromToolResult(messages)).toBe("¿Qué horas? → En movimiento");
  });

  it("returns null for a widget acknowledgement", () => {
    const messages = [
      askCall,
      { role: "tool", toolCallId: "tc2", content: "{}" },
    ];
    expect(answerFromToolResult(messages)).toBeNull();
  });
});

describe("humanize", () => {
  it("reads a column name as a label", () => {
    expect(humanize("driving_hours")).toBe("Driving hours");
  });
});
