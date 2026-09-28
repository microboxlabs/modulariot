/**
 * The chat's answer contract: the miot-analyst skill answers with a JSON
 * array of blocks (markdown, url, widget, choices, assumption), and the
 * harness reports each widget's data in a `widget.created` event. This module
 * turns both into the AG-UI events the chat panel renders: text messages,
 * `show_dashlet` tool calls (real dashboard widgets) and `ask_user_question`
 * tool calls. Pure, so the whole mapping is unit-tested.
 */

export type WidgetKind = "kpi" | "table" | "bar" | "line" | "pie";

export type WidgetSpec = {
  id: string;
  kind: WidgetKind;
  title: string;
  subtitle?: string | null;
  x?: string | null;
  y: string[];
  unit?: string | null;
  columns: string[];
  rows: Record<string, unknown>[];
  truncated?: boolean;
};

export type ChoicesValue = {
  question: string;
  description?: string;
  options: { label: string; description?: string }[];
  allowMultiple?: boolean;
  allowOther?: boolean;
};

export type ChatBlock =
  | { type: "markdown"; value: string }
  | { type: "url"; value: { url: string; name: string } }
  | { type: "widget"; value: { id: string } }
  | { type: "choices"; value: ChoicesValue }
  | { type: "assumption"; value: { term: string; interpretation: string } };

export type ChatEvent = Record<string, unknown>;

const WIDGET_KINDS: ReadonlySet<string> = new Set([
  "kpi",
  "table",
  "bar",
  "line",
  "pie",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Absolute http(s), or an app-relative path (a protocol-relative `//host` is rejected). */
function isSafeHref(url: string): boolean {
  return (
    /^https?:\/\//i.test(url) || (url.startsWith("/") && !url.startsWith("//"))
  );
}

function isChoices(value: unknown): value is ChoicesValue {
  if (!isRecord(value) || typeof value.question !== "string") return false;
  const options = value.options;
  return (
    Array.isArray(options) &&
    options.length > 0 &&
    options.every((o) => isRecord(o) && typeof o.label === "string")
  );
}

function toChatBlock(item: unknown): ChatBlock | null {
  if (!isRecord(item)) return null;
  const { type, value } = item;
  if (type === "markdown" && typeof value === "string") return { type, value };
  if (
    type === "url" &&
    isRecord(value) &&
    typeof value.url === "string" &&
    typeof value.name === "string"
  ) {
    return isSafeHref(value.url)
      ? { type, value: { url: value.url, name: value.name } }
      : null;
  }
  if (type === "widget" && isRecord(value) && typeof value.id === "string")
    return { type, value: { id: value.id } };
  if (type === "choices" && isChoices(value)) return { type, value };
  if (
    type === "assumption" &&
    isRecord(value) &&
    typeof value.term === "string"
  ) {
    return {
      type,
      value: {
        term: value.term,
        interpretation:
          typeof value.interpretation === "string" ? value.interpretation : "",
      },
    };
  }
  return null;
}

/** Parse the run's answer; anything that is not a block array is one markdown block. */
export function parseChatBlocks(
  answer: string | null | undefined
): ChatBlock[] {
  if (!answer) return [];
  try {
    const parsed: unknown = JSON.parse(answer);
    if (Array.isArray(parsed)) {
      return parsed.map(toChatBlock).filter((b): b is ChatBlock => b !== null);
    }
  } catch {
    // not JSON: shown as text below
  }
  return [{ type: "markdown", value: answer }];
}

function toWidgetSpec(value: unknown): WidgetSpec | null {
  if (
    !isRecord(value) ||
    typeof value.id !== "string" ||
    !WIDGET_KINDS.has(String(value.kind))
  ) {
    return null;
  }
  const rows = Array.isArray(value.rows) ? value.rows.filter(isRecord) : [];
  const columns = Array.isArray(value.columns)
    ? value.columns.filter((c): c is string => typeof c === "string")
    : Object.keys(rows[0] ?? {});
  return {
    id: value.id,
    kind: value.kind as WidgetKind,
    title: typeof value.title === "string" ? value.title : "",
    subtitle: typeof value.subtitle === "string" ? value.subtitle : null,
    x: typeof value.x === "string" ? value.x : null,
    y: Array.isArray(value.y)
      ? value.y.filter((c): c is string => typeof c === "string")
      : [],
    unit: typeof value.unit === "string" ? value.unit : null,
    columns,
    rows,
    truncated: value.truncated === true,
  };
}

/** The widgets a run produced, from its `widget.created` events, in order. */
export function widgetsOf(events: unknown): WidgetSpec[] {
  if (!Array.isArray(events)) return [];
  return events
    .filter(
      (e) => isRecord(e) && e.type === "widget.created" && isRecord(e.data)
    )
    .map((e) =>
      toWidgetSpec((e as { data: Record<string, unknown> }).data.widget)
    )
    .filter((w): w is WidgetSpec => w !== null);
}

/** `driving_hours` → `Driving hours`: column names read as labels. */
export function humanize(column: string): string {
  const spaced = column.replace(/_/g, " ").trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

function cell(value: unknown): string {
  if (value === null || value === undefined) return "";
  return typeof value === "string" ? value : JSON.stringify(value);
}

function stringRows(spec: WidgetSpec): Record<string, string>[] {
  return spec.rows.map((row) =>
    Object.fromEntries(spec.columns.map((c) => [c, cell(row[c])]))
  );
}

const STATIC_DATA = {
  dataMode: "static",
  pgrestFunctionName: "",
  pgrestParams: [],
  pgrestHttpMethod: "POST",
} as const;

function kpiConfig(spec: WidgetSpec): Record<string, unknown> {
  const valueColumn =
    spec.y[0] ??
    spec.columns.find((c) => c !== spec.x) ??
    spec.columns[0] ??
    "value";
  const row = stringRows(spec)[0] ?? {};
  return {
    ...STATIC_DATA,
    staticData: JSON.stringify(row),
    title: spec.title,
    value: `{{row.${valueColumn}}}`,
    unit: spec.unit ?? "",
    subtitle: spec.subtitle ?? "",
    cardVariant: "horizontal",
    showIcon: true,
    icon: "hi2-chart-bar",
    iconColor: "1c64f2",
  };
}

function tableConfig(spec: WidgetSpec): Record<string, unknown> {
  const numeric = new Set(spec.y);
  return {
    ...STATIC_DATA,
    title: spec.truncated ? `${spec.title} (${spec.rows.length}+)` : spec.title,
    showRowCount: true,
    showColumnDividers: true,
    showExport: true,
    striped: true,
    columns: spec.columns.map((c) => ({
      key: `{{row.${c}}}`,
      label: humanize(c),
      type: numeric.has(c) ? "highlight" : "text",
    })),
    rows: stringRows(spec),
    filter: { enabled: false, items: [] },
    sort: { enabled: true, columns: spec.columns.map((c) => `{{row.${c}}}`) },
  };
}

function chartConfig(spec: WidgetSpec): Record<string, unknown> {
  const pie = spec.kind === "pie";
  return {
    ...STATIC_DATA,
    title: spec.title,
    chartFamily: pie ? "pie" : "cartesian",
    xAxisColumn: spec.x ?? spec.columns[0] ?? "",
    representations: spec.y.map((c) => ({
      columnKey: c,
      label: spec.unit ? `${humanize(c)} (${spec.unit})` : humanize(c),
      type: spec.kind === "bar" || pie ? "bar" : "line",
      smooth: spec.kind === "line",
      showLabels: spec.rows.length <= 12,
    })),
    xAxisLabel: "",
    yAxisLabel: spec.unit ?? "",
    showLegend: pie || spec.y.length > 1,
    horizontal: false,
    colorPalette: "default",
    customColors: [],
    rows: stringRows(spec),
  };
}

/** The dashboard dashlet that renders a widget, with its data inline. */
export function widgetToDashlet(spec: WidgetSpec): {
  dashletId: string;
  config: Record<string, unknown>;
} {
  if (spec.kind === "kpi")
    return { dashletId: "stat_icon", config: kpiConfig(spec) };
  if (spec.kind === "table")
    return { dashletId: "data_table_v2", config: tableConfig(spec) };
  return { dashletId: "chart_v2", config: chartConfig(spec) };
}

function toolCall(
  name: string,
  args: unknown,
  newId: () => string
): ChatEvent[] {
  const toolCallId = newId();
  return [
    { type: "TOOL_CALL_START", toolCallId, toolCallName: name },
    { type: "TOOL_CALL_ARGS", toolCallId, delta: JSON.stringify(args) },
    { type: "TOOL_CALL_END", toolCallId },
  ];
}

function textMessage(text: string, newId: () => string): ChatEvent[] {
  const messageId = newId();
  return [
    { type: "TEXT_MESSAGE_START", messageId },
    { type: "TEXT_MESSAGE_CONTENT", messageId, delta: text },
    { type: "TEXT_MESSAGE_END", messageId },
  ];
}

/** Collects the answer's parts in order while blocks are read. */
class AnswerBuilder {
  readonly out: ChatEvent[] = [];
  private text: string[] = [];
  private readonly placed = new Set<string>();
  readonly assumptions: string[] = [];
  choices: ChoicesValue | null = null;

  constructor(
    private readonly widgets: Map<string, WidgetSpec>,
    private readonly newId: () => string
  ) {}

  add(block: ChatBlock): void {
    switch (block.type) {
      case "markdown":
        this.text.push(block.value);
        return;
      case "url":
        this.text.push(`[${block.value.name}](${block.value.url})`);
        return;
      case "assumption":
        this.assumptions.push(
          `'${block.value.term}' = ${block.value.interpretation}`
        );
        return;
      case "choices":
        this.choices = block.value;
        return;
      case "widget":
        this.placeWidget(block.value.id);
    }
  }

  note(line: string): void {
    this.text.push(line);
  }

  flush(): void {
    if (this.text.length)
      this.out.push(...textMessage(this.text.join("\n\n"), this.newId));
    this.text = [];
  }

  placeWidget(id: string): void {
    const spec = this.widgets.get(id);
    if (!spec || this.placed.has(id)) return;
    this.flush();
    this.out.push(
      ...toolCall("show_dashlet", widgetToDashlet(spec), this.newId)
    );
    this.placed.add(id);
  }

  placeRemainingWidgets(): void {
    for (const id of this.widgets.keys()) this.placeWidget(id);
  }
}

/**
 * The AG-UI events that present one run's answer: text in order, each widget
 * where its block sits (widgets the answer never placed come after the text),
 * and a choices block as an `ask_user_question` card at the end.
 */
export function chatAnswerEvents(
  answer: string | null | undefined,
  events: unknown,
  opts: { noAnswer: string; assumptionLabel: string; newId?: () => string }
): ChatEvent[] {
  const newId = opts.newId ?? (() => crypto.randomUUID());
  const builder = new AnswerBuilder(
    new Map(widgetsOf(events).map((w) => [w.id, w])),
    newId
  );
  for (const block of parseChatBlocks(answer)) builder.add(block);
  if (builder.assumptions.length) {
    builder.note(
      `_${opts.assumptionLabel}: ${builder.assumptions.join("; ")}_`
    );
  }
  builder.flush();
  builder.placeRemainingWidgets();
  if (builder.choices)
    builder.out.push(...toolCall("ask_user_question", builder.choices, newId));
  if (builder.out.length === 0)
    builder.out.push(...textMessage(opts.noAnswer, newId));
  return builder.out;
}

type ToolCallRecord = {
  id?: unknown;
  function?: { name?: unknown; arguments?: unknown };
};

function questionOf(call: ToolCallRecord): string {
  const raw = call.function?.arguments;
  try {
    const args: unknown = typeof raw === "string" ? JSON.parse(raw) : raw;
    return isRecord(args) && typeof args.question === "string"
      ? args.question
      : "";
  } catch {
    return "";
  }
}

function pickedOf(content: unknown): string[] {
  let result: unknown = content;
  if (typeof content === "string") {
    try {
      result = JSON.parse(content);
    } catch {
      return content ? [content] : [];
    }
  }
  if (!isRecord(result)) return [];
  const selected = Array.isArray(result.selected)
    ? result.selected.map(String)
    : [];
  const other = typeof result.other === "string" ? result.other : "";
  return [...selected, other].filter(Boolean);
}

/**
 * When the user answered an `ask_user_question` card, the message the harness
 * should receive: the question and the chosen options, in plain words. Null
 * for any other tool result (a widget's automatic acknowledgement).
 */
export function answerFromToolResult(
  messages: {
    role: string;
    content?: unknown;
    toolCallId?: string;
    toolCalls?: unknown;
  }[]
): string | null {
  const last = messages.at(-1);
  if (last?.role !== "tool" || !last.toolCallId) return null;
  const call = messages
    .flatMap((m) =>
      Array.isArray(m.toolCalls) ? (m.toolCalls as ToolCallRecord[]) : []
    )
    .find((c) => c.id === last.toolCallId);
  if (call?.function?.name !== "ask_user_question") return null;
  const picked = pickedOf(last.content);
  if (picked.length === 0) return null;
  const question = questionOf(call);
  return question ? `${question} → ${picked.join(", ")}` : picked.join(", ");
}
