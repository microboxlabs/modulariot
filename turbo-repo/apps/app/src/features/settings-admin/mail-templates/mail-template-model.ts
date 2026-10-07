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
