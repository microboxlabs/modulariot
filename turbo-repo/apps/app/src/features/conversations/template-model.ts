import type {
  ConversationTemplate,
  EmailVariant,
  EventField,
  EventTypeInfo,
  MetaTemplate,
  TemplateBody,
} from "./conversations-types";
import { findMetaTemplate } from "./meta-template-combobox";
import { eventVariables, textVariables } from "./rule-model";

/** Values the preview and Meta's examples start from; no real person, phone or plate. */
export const SAMPLE_VALUES: Record<string, string> = {
  nombre: "Juan Soto",
  patente: "TEST01",
  hora: "14:05",
  sintoma: "Botón de pánico",
  nivel: "Código negro",
  fecha: "23-10-2026",
  ubicacion: "-33.44890, -70.66930",
  tripId: "VJ-0001",
  serviceCode: "SRV-0001",
  orderRef: "OT-0001",
  origin: "Santiago",
  destination: "Antofagasta",
  plannedStart: "23-10-2026 08:00",
  plannedEnd: "24-10-2026 06:00",
  truck: "TEST01",
  trailer: "TEST02",
  driver: "Juan Soto",
  carrierName: "Transportes Ejemplo",
  carrierRut: "11.111.111-1",
  monitor: "Monitor de viajes",
  alert: "Salida atrasada",
  rule: "Viajes · alertas",
  milestone: "Salida",
  source: "GPS",
  proposedAt: "23-10-2026 08:12",
  confirmedAt: "23-10-2026 08:15",
  otherAt: "23-10-2026 08:20",
  channel: "Correo",
  actor: "Torre de control",
  changedFields: "Destino",
  organization: "transportes-ejemplo",
  company: "Transportes Ejemplo",
  month: "2026-10",
  used: "800",
  quota: "1000",
  pct: "80",
  exhausted: "review",
  action: "Las direcciones nuevas quedarán para revisión manual.",
};

/** Variables every event gives a template. */
const COMMON = ["nombre", "fecha", "hora"];

/** The variables a template can use: the event's, or the common ones without an event. */
export function templateVariables(
  info: EventTypeInfo | undefined,
  catalog: EventTypeInfo[] | undefined
): EventField[] {
  if (info) return eventVariables(info);
  const seen = new Map<string, EventField>();
  for (const e of catalog ?? [])
    for (const v of e.variables ?? [])
      if (COMMON.includes(v.name) && !seen.has(v.name)) seen.set(v.name, v);
  return COMMON.map((n) => seen.get(n)).filter(
    (v): v is EventField => v !== undefined
  );
}

const NUMBER = /(int|long|double|float|number|decimal)/i;

function eventExample(v: EventField): string {
  return NUMBER.test(v.type) ? "42" : v.label;
}

/**
 * An example value per variable: the known sample, else for the event's variables a number or their label.
 * A used variable the event does not give has none, so the preview marks it.
 */
export function exampleValues(
  variables: EventField[],
  names: string[]
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const v of variables)
    out[v.name] = SAMPLE_VALUES[v.name] ?? eventExample(v);
  for (const name of names)
    if (!(name in out) && SAMPLE_VALUES[name]) out[name] = SAMPLE_VALUES[name];
  return out;
}

/** The events of the rules that use the template, first one first and without repeats. */
export function usedEvents(template: ConversationTemplate | null): string[] {
  return [
    ...new Set(
      (template?.usedBy ?? [])
        .map((r) => r.event)
        .filter((e): e is string => Boolean(e))
    ),
  ];
}

/** A Meta template name: lowercase letters, digits and underscores. */
export function metaNameFrom(key: string): string {
  const normalized = key.toLowerCase().replaceAll(/[^a-z0-9_]+/g, "_");
  let start = 0;
  let end = normalized.length;
  while (start < end && normalized[start] === "_") start++;
  while (end > start && normalized[end - 1] === "_") end--;
  return normalized.slice(start, end);
}

/** The parameters a WhatsApp send fills: Meta's when it has the template, else the text's. */
export function sendParams(
  body: TemplateBody,
  templates: MetaTemplate[] | undefined
): string[] {
  if (!body.whatsapp) return [];
  const meta = findMetaTemplate(
    templates,
    body.whatsapp.metaName,
    body.whatsapp.language
  );
  if (meta && meta.language === body.whatsapp.language) return meta.params;
  return textVariables(body.baseText);
}

const ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
};

/** Plain text as HTML: escaped, a paragraph per blank-line block and a line break per newline. */
export function textToHtml(text: string): string {
  return text
    .trim()
    .split(/\n\s*\n/)
    .filter((p) => p.trim())
    .map(
      (p) =>
        `<p>${p
          .trim()
          .replaceAll(/[&<>"]/g, (c) => ESCAPES[c])
          .replaceAll("\n", "<br>\n")}</p>`
    )
    .join("\n");
}

/** An HTML body's text, roughly: tags dropped, the common entities read, blank runs closed up. */
export function htmlToText(html: string): string {
  const parts: string[] = [];
  let cursor = 0;
  while (cursor < html.length) {
    const open = html.indexOf("<", cursor);
    if (open === -1) {
      parts.push(html.slice(cursor));
      break;
    }
    parts.push(html.slice(cursor, open));
    const close = html.indexOf(">", open + 1);
    if (close === -1) {
      parts.push(html.slice(open));
      break;
    }
    const tag = html.slice(open + 1, close);
    if (/^(br|\/p|\/h\d|\/tr|\/li)\b/i.test(tag)) parts.push("\n");
    cursor = close + 1;
  }
  return parts
    .join("")
    .replaceAll("&nbsp;", " ")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&amp;", "&")
    .replaceAll(/\n[ \t]*\n\s*/g, "\n\n")
    .trim();
}

/** An email variant with its body in HTML: a plain-text body from before HTML is turned into paragraphs. */
export function withHtml(email: EmailVariant | null): EmailVariant | null {
  if (!email || email.html?.trim()) return email;
  return {
    subject: email.subject,
    body: null,
    html: textToHtml(email.body ?? ""),
  };
}

/** The fields the draft changes against the stored template. */
export function changedFields(
  body: TemplateBody,
  stored: TemplateBody
): string[] {
  const same = (a: unknown, b: unknown) =>
    JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
  const out: string[] = [];
  if (body.name.trim() !== stored.name.trim()) out.push("name");
  if (body.baseText !== stored.baseText) out.push("baseText");
  if (!same(body.whatsapp, stored.whatsapp)) out.push("whatsapp");
  if (!same(body.email, stored.email)) out.push("email");
  return out;
}

export type FindingSeverity = "error" | "warning" | "info";
export type FindingSection = "general" | "text" | "whatsapp" | "email";

export interface TemplateFinding {
  severity: FindingSeverity;
  section: FindingSection;
  /** A key of the communications dictionary. */
  key: string;
  values?: Record<string, string>;
}

/**
 * What would stop the template from saving (errors) or from sending as written (warnings). `variables` is
 * null without an event: then nothing is said about which variables exist.
 */
export function templateFindings({
  body,
  keyTaken,
  variables,
  metaTemplates,
}: {
  body: TemplateBody;
  keyTaken: boolean;
  variables: string[] | null;
  /** Undefined when the WhatsApp account could not be read. */
  metaTemplates: MetaTemplate[] | undefined;
}): TemplateFinding[] {
  const out: TemplateFinding[] = [];
  if (!body.name.trim())
    out.push({ severity: "error", section: "general", key: "tplNoName" });
  if (keyTaken)
    out.push({
      severity: "error",
      section: "general",
      key: "templateKeyTaken",
    });
  // WhatsApp sends the short text, and without an email Slack, Teams and webhooks have nothing else.
  if (!body.baseText.trim() && (body.whatsapp || !body.email))
    out.push({ severity: "error", section: "text", key: "tplNoText" });

  if (variables) {
    const known = new Set(variables);
    const texts = [
      body.baseText,
      body.email?.subject ?? "",
      body.email?.body ?? "",
      body.email?.html ?? "",
    ];
    const unknown = [...new Set(texts.flatMap((t) => textVariables(t)))].filter(
      (v) => !known.has(v)
    );
    if (unknown.length > 0)
      out.push({
        severity: "warning",
        section: "text",
        key: "tplUnknownVariables",
        values: { names: unknown.join(", ") },
      });
  }

  if (body.whatsapp) {
    const w = body.whatsapp;
    const meta = findMetaTemplate(metaTemplates, w.metaName, w.language);
    const onWaba = meta && meta.language === w.language;
    if (!w.metaName.trim())
      out.push({
        severity: "error",
        section: "whatsapp",
        key: "tplNoMetaName",
      });
    else if (metaTemplates && !onWaba)
      out.push({
        severity: "warning",
        section: "whatsapp",
        key: "tplNotOnMeta",
      });
    else if (meta && onWaba) {
      if (meta.status === "REJECTED")
        out.push({
          severity: "error",
          section: "whatsapp",
          key: "tplMetaRejected",
          values: { reason: meta.rejectedReason ?? "—" },
        });
      else if (meta.status === "PENDING")
        out.push({
          severity: "info",
          section: "whatsapp",
          key: "tplMetaPending",
        });
      else if (meta.status !== "APPROVED")
        out.push({
          severity: "warning",
          section: "whatsapp",
          key: "metaNotApproved",
        });
      if (meta.status !== "PENDING" && meta.body !== body.baseText.trim())
        out.push({
          severity: "warning",
          section: "whatsapp",
          key: "tplMetaTextDiffers",
        });
      const headerParams = textVariables(meta.header ?? "");
      if (headerParams.length > 0)
        out.push({
          severity: "error",
          section: "whatsapp",
          key: "metaHeaderParams",
          values: { params: headerParams.join(", ") },
        });
      if (meta.parameterFormat === "POSITIONAL" && meta.params.length > 0)
        out.push({
          severity: "error",
          section: "whatsapp",
          key: "metaPositional",
        });
    }
  }

  if (body.email) {
    if (!body.email.subject.trim())
      out.push({ severity: "error", section: "email", key: "tplNoSubject" });
    if (!body.email.html?.trim() && !body.email.body?.trim())
      out.push({ severity: "error", section: "email", key: "tplNoEmailBody" });
  }
  if (!body.whatsapp && !body.email)
    out.push({ severity: "info", section: "general", key: "tplNoChannel" });
  return out;
}
