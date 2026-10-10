/** Where an email template is edited: the platform's, or the active organization's. */
export type TemplateScope = "platform" | "organization";

export type TemplateLang = "es" | "en";

export const TEMPLATE_LANGS: readonly TemplateLang[] = ["es", "en"];

/** Mirrors `MailTemplates.TemplateView`. */
export interface MailTemplate {
  kind: string;
  lang: TemplateLang;
  source: "ORGANIZATION" | "PLATFORM" | "DEFAULT";
  subject: string;
  html: string;
  updatedAt: string | null;
  updatedBy: string | null;
  variables: string[];
}

/** Mirrors `MailTemplates.SaveTemplateRequest`. */
export interface SaveMailTemplate {
  subject: string;
  html: string;
}

/** Mirrors `MailTemplates.PreviewView`. */
export interface MailTemplatePreview {
  subject: string;
  html: string;
}

export const INVITATION = "invitation";

export function templateUrl(scope: TemplateScope, lang: TemplateLang): string {
  return scope === "platform"
    ? `/app/api/admin/platform/mail-templates/${INVITATION}/${lang}`
    : `/app/api/mail-templates/${INVITATION}/${lang}`;
}

/** True when the template shown is this scope's own, which can be reset. */
export function isOwnTemplate(
  scope: TemplateScope,
  template: MailTemplate
): boolean {
  return scope === "platform"
    ? template.source === "PLATFORM"
    : template.source === "ORGANIZATION";
}

/** The i18n key describing where the template comes from. */
export function sourceKey(
  scope: TemplateScope,
  template: MailTemplate
): "sourceOwn" | "sourcePlatform" | "sourceDefault" {
  if (isOwnTemplate(scope, template)) return "sourceOwn";
  return template.source === "PLATFORM" ? "sourcePlatform" : "sourceDefault";
}

/** Inserts `{{name}}` at the selection, returning the new text and caret. */
export function insertVariable(
  text: string,
  name: string,
  start: number,
  end: number
): { text: string; caret: number } {
  const token = `{{${name}}}`;
  return {
    text: text.slice(0, start) + token + text.slice(end),
    caret: start + token.length,
  };
}

/** Block helpers a template can open with `{{#name}}` and close with `{{/name}}`. */
export const BLOCK_HELPERS = ["if", "unless", "each", "with"];

/** What to complete after `{{`: a variable, a block to open or a block to close. */
export interface HandlebarsCompletion {
  /** Offset in the typed text where the name being typed starts. */
  offset: number;
  kind: "variable" | "open" | "close";
  names: string[];
}

/**
 * Completions for the text typed since `{{`, e.g. `{{or`, `{{#i`, `{{/`.
 * Null when the text does not start a mustache.
 */
export function handlebarsCompletions(
  typed: string,
  variables: readonly string[]
): HandlebarsCompletion | null {
  if (!typed.startsWith("{{")) return null;
  let offset = 2;
  const marker = typed.charAt(offset);
  if (marker === "#" || marker === "/" || marker === "^" || marker === "~") {
    offset += 1;
  }
  while (typed.charAt(offset) === " ") offset += 1;
  if (marker === "#") return { offset, kind: "open", names: BLOCK_HELPERS };
  if (marker === "/") return { offset, kind: "close", names: BLOCK_HELPERS };
  return { offset, kind: "variable", names: [...variables] };
}

/**
 * Where Handlebars says the error is. Its messages carry `:line:column:`
 * (line from 1, column from 0); without them, the start of the template.
 */
export function problemOffset(message: string, doc: string): number {
  const match = /:(\d+):(\d+)/.exec(message);
  if (!match) return 0;
  const line = Number.parseInt(match[1] ?? "1", 10);
  const column = Number.parseInt(match[2] ?? "0", 10);
  let start = 0;
  for (let n = 1; n < line; n++) {
    const next = doc.indexOf("\n", start);
    if (next < 0) return doc.length;
    start = next + 1;
  }
  return Math.min(doc.length, start + column);
}
