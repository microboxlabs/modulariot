import { describe, expect, it } from "vitest";

import {
  answerFromToolResult,
  artifactsOf,
  chatAnswerEvents,
  dashletsInThread,
  dateFormatOf,
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
      xAxisColumn: "c0",
      representations: [
        { columnKey: "c1", label: "Driving hours (h)", type: "bar" },
      ],
      rows: [
        { c0: "Cordillera", c1: "4983.1" },
        { c0: "Altiplano", c1: "4490.1" },
      ],
    });
  });

  it("maps a kpi to stat_icon over the first row", () => {
    const { dashletId, config } = widgetToDashlet({ ...spec, kind: "kpi" });
    expect(dashletId).toBe("stat_icon");
    expect(config.value).toBe("{{row.c1}}");
    expect(JSON.parse(String(config.staticData))).toEqual({
      c0: "Cordillera",
      c1: "4983.1",
    });
  });

  it("maps a table to data_table_v2 with sortable, labelled columns", () => {
    const { dashletId, config } = widgetToDashlet({ ...spec, kind: "table" });
    expect(dashletId).toBe("data_table_v2");
    expect(config.columns).toEqual([
      { key: "{{row.c0}}", label: "Carrier", type: "text" },
      {
        key: "{{row.c1}}",
        label: "Driving hours",
        type: "highlight",
      },
    ]);
    expect(config.sort).toEqual({
      enabled: true,
      columns: ["{{row.c0}}", "{{row.c1}}"],
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
      "TOOL_CALL_RESULT",
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

describe("widget polish", () => {
  const dated = (dates: string[]): WidgetSpec => ({
    id: "w",
    kind: "line",
    title: "t",
    x: "d",
    y: ["n"],
    columns: ["d", "n"],
    rows: dates.map((d) => ({ d, n: "1" })),
  });

  it("formats a date axis by day or month", () => {
    expect(dateFormatOf(dated(["2026-09-01", "2026-09-02"]))).toBe("day");
    expect(dateFormatOf(dated(["2026-08-01", "2026-09-01"]))).toBe("month");
    expect(dateFormatOf(dated(["Cordillera", "Altiplano"]))).toBe("none");
    expect(
      dateFormatOf({ ...dated(["2026-09-01", "2026-09-02"]), x: null })
    ).toBe("day");
  });

  it("sends each widget's result with it so no empty run follows", () => {
    const answer = JSON.stringify([{ type: "widget", value: { id: "w1" } }]);
    const events = chatAnswerEvents(answer, runEvents, {
      ...opts,
      newId: counter(),
    });
    const result = events.find((e) => e.type === "TOOL_CALL_RESULT");
    const start = events.find((e) => e.type === "TOOL_CALL_START");
    expect(result).toMatchObject({
      toolCallId: start?.toolCallId,
      content: "{}",
      role: "tool",
    });
  });
});

describe("column names the model chose", () => {
  it("are replaced by safe keys and kept as labels", () => {
    const spec: WidgetSpec = {
      id: "w",
      kind: "table",
      title: "Top patentes",
      x: null,
      y: ["Códigos negros", "% atendido"],
      columns: ["Patente", "Códigos negros", "% atendido"],
      rows: [{ Patente: "LWZS50", "Códigos negros": 41, "% atendido": "0.0" }],
    };
    const { config } = widgetToDashlet(spec);
    expect(config.columns).toEqual([
      { key: "{{row.c0}}", label: "Patente", type: "text" },
      { key: "{{row.c1}}", label: "Códigos negros", type: "highlight" },
      { key: "{{row.c2}}", label: "% atendido", type: "highlight" },
    ]);
    expect(config.rows).toEqual([{ c0: "LWZS50", c1: "41", c2: "0.0" }]);
  });
});

describe("artifacts", () => {
  const diagram = {
    id: "a1",
    kind: "svg",
    title: "Proceso",
    content: "<svg></svg>",
    source: "Fleet",
  };
  const note = { id: "a2", kind: "markdown", title: "Nota", content: "# Hi" };
  const events = [
    { type: "artifact.created", data: diagram },
    { type: "artifact.created", data: { id: "a3", kind: "pdf", content: "" } },
    { type: "artifact.created", data: note },
  ];

  it("reads the artifacts a run produced and drops unknown kinds", () => {
    expect(artifactsOf(events).map((a) => a.id)).toEqual(["a1", "a2"]);
  });

  it("places an artifact where its block sits and the rest after the text", () => {
    const answer = JSON.stringify([
      { type: "markdown", value: "Antes" },
      { type: "artifact", value: { id: "a2" } },
      { type: "markdown", value: "Después" },
    ]);
    const out = chatAnswerEvents(answer, events, { ...opts, newId: counter() });
    expect(
      out.filter((e) => e.type === "TOOL_CALL_START").map((e) => e.toolCallName)
    ).toEqual(["show_artifact", "show_artifact"]);
    const args = out
      .filter((e) => e.type === "TOOL_CALL_ARGS")
      .map((e) => JSON.parse(String(e.delta)));
    expect(args).toEqual([note, diagram]);
    expect(out.filter((e) => e.type === "TOOL_CALL_RESULT")).toHaveLength(2);
    expect(
      out.filter((e) => e.type === "TEXT_MESSAGE_CONTENT").map((e) => e.delta)
    ).toEqual(["Antes", "Después"]);
  });
});

describe("dashboard drafts", () => {
  const kpiWidget = {
    id: "w2",
    kind: "kpi",
    title: "Viajes",
    y: ["trips"],
    columns: ["trips"],
    rows: [{ trips: 41 }],
  };
  const draftEvent = (widgets: string[]) => ({
    type: "dashboard.draft",
    data: { id: "d1", title: "Semana", description: "Viajes", widgets },
  });

  function argsOf(events: Record<string, unknown>[], name: string): unknown[] {
    const ids = new Set(
      events
        .filter((e) => e.type === "TOOL_CALL_START" && e.toolCallName === name)
        .map((e) => e.toolCallId)
    );
    return events
      .filter((e) => e.type === "TOOL_CALL_ARGS" && ids.has(e.toolCallId))
      .map((e) => JSON.parse(String(e.delta)));
  }

  it("tags each shown dashlet with its widget id", () => {
    const events = chatAnswerEvents("[]", runEvents, {
      ...opts,
      newId: counter(),
    });
    expect(argsOf(events, "show_dashlet")).toEqual([
      { ...widgetToDashlet(barWidget as WidgetSpec), widgetId: "w1" },
    ]);
  });

  it("resolves the draft's widgets from this run and from earlier turns, in its order", () => {
    const prior = dashletsInThread([
      { toolCalls: "not a list" },
      {
        toolCalls: [
          {
            id: "t1",
            function: {
              name: "show_dashlet",
              arguments: JSON.stringify({
                widgetId: "w2",
                ...widgetToDashlet(kpiWidget as WidgetSpec),
              }),
            },
          },
          {
            id: "t2",
            function: { name: "ask_user_question", arguments: "{}" },
          },
          { id: "t3", function: { name: "show_dashlet", arguments: "{bad" } },
        ],
      },
    ]);

    const events = chatAnswerEvents(
      "[]",
      [...runEvents, draftEvent(["w2", "w1", "w9"])],
      { ...opts, newId: counter(), priorDashlets: prior }
    );

    const [draft] = argsOf(events, "show_dashboard_draft") as {
      dashlets: { widgetId: string; dashletId: string }[];
      missing: string[];
    }[];
    expect(draft).toMatchObject({
      id: "d1",
      title: "Semana",
      description: "Viajes",
    });
    expect(draft!.dashlets.map((d) => [d.widgetId, d.dashletId])).toEqual([
      ["w2", "stat_icon"],
      ["w1", "chart_v2"],
    ]);
    expect(draft!.missing).toEqual(["w9"]);
    expect(events.at(-1)).toMatchObject({
      type: "TOOL_CALL_RESULT",
      content: "{}",
    });
  });

  it("comes after the widgets and before the choices card", () => {
    const answer = JSON.stringify([
      { type: "markdown", value: "Listo" },
      {
        type: "choices",
        value: { question: "¿Guardar?", options: [{ label: "Sí" }] },
      },
    ]);
    const names = chatAnswerEvents(answer, [...runEvents, draftEvent(["w1"])], {
      ...opts,
      newId: counter(),
    })
      .filter((e) => e.type === "TOOL_CALL_START")
      .map((e) => e.toolCallName);
    expect(names).toEqual([
      "show_dashlet",
      "show_dashboard_draft",
      "ask_user_question",
    ]);
  });
});
