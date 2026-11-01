import type {
  MetaButtonType,
  MetaTemplate,
  MetaTemplateDraft,
} from "./conversations-types";
import { textVariables } from "./rule-model";

export const META_LANGUAGES = [
  "es_CL",
  "es",
  "es_MX",
  "es_AR",
  "en_US",
  "en",
  "pt_BR",
];
export const META_CATEGORIES = ["UTILITY", "MARKETING"] as const;
export const BUTTON_TYPES: MetaButtonType[] = [
  "QUICK_REPLY",
  "URL",
  "PHONE_NUMBER",
];
export const LIMITS = {
  body: 1024,
  header: 60,
  footer: 60,
  buttons: 10,
  buttonText: 25,
  urlButtons: 2,
  phoneButtons: 1,
};

const NAME = /^[a-z0-9_]{1,512}$/;
const PARAM_NAME = /^[a-z][a-z0-9_]*$/;
const URL = /^https?:\/\/\S+$/;
const PHONE = /^\+[1-9]\d{6,14}$/;

export const EMPTY_META_DRAFT: MetaTemplateDraft = {
  name: "",
  language: "es_CL",
  category: "UTILITY",
  header: "",
  body: "",
  footer: "",
  buttons: [],
  examples: {},
};

/** Why the app cannot edit a template on Meta. */
export function metaTemplateLock(t: MetaTemplate | null): string | null {
  if (!t) return null;
  if (t.status === "PENDING") return "metaLockedPending";
  if (t.category === "AUTHENTICATION") return "metaLockedAuthentication";
  if (t.headerFormat && t.headerFormat !== "TEXT") return "metaLockedMedia";
  if (t.parameterFormat !== "NAMED" && t.params.length > 0)
    return "metaLockedPositional";
  return null;
}

/** The editor's draft for a template on Meta; a new one starts empty. */
export function draftOf(t: MetaTemplate | null): MetaTemplateDraft {
  if (!t) return EMPTY_META_DRAFT;
  return {
    name: t.name,
    language: t.language,
    category: t.category === "MARKETING" ? "MARKETING" : "UTILITY",
    header: t.headerFormat === "TEXT" ? (t.header ?? "") : "",
    body: t.body ?? "",
    footer: t.footer ?? "",
    buttons: t.buttons.map((b) => ({ ...b })),
    examples: { ...t.examples },
  };
}

/** Header then body parameters, each once: the ones that need an example. */
export function draftParams(draft: MetaTemplateDraft): string[] {
  return [
    ...new Set([...textVariables(draft.header), ...textVariables(draft.body)]),
  ];
}

/** A message key of the communications dictionary and its values. */
export interface DraftProblem {
  key: string;
  values?: Record<string, string>;
}

/** Meta's rules the editor can check before submitting; the server checks them again. */
export function draftProblems(
  draft: MetaTemplateDraft,
  isNew: boolean
): DraftProblem[] {
  const out: DraftProblem[] = [];
  if (isNew && !NAME.test(draft.name)) out.push({ key: "metaErrName" });
  const body = draft.body.trim();
  if (!body) out.push({ key: "metaErrBody" });
  else if (body.startsWith("{{") || body.endsWith("}}"))
    out.push({ key: "metaErrBodyEdges" });
  if (draft.body.length > LIMITS.body)
    out.push({ key: "metaErrTooLong", values: { n: String(LIMITS.body) } });
  if (textVariables(draft.header).length > 1)
    out.push({ key: "metaErrHeaderParams" });
  if (textVariables(draft.footer).length > 0)
    out.push({ key: "metaErrFooterParams" });
  for (const p of draftParams(draft)) {
    if (!PARAM_NAME.test(p))
      out.push({ key: "metaErrParamName", values: { name: p } });
    else if (!draft.examples[p]?.trim())
      out.push({ key: "metaErrExample", values: { name: p } });
  }
  out.push(...buttonProblems(draft));
  return out;
}

function buttonProblems(draft: MetaTemplateDraft): DraftProblem[] {
  const out: DraftProblem[] = [];
  const buttons = draft.buttons;
  if (buttons.length > LIMITS.buttons) out.push({ key: "metaErrButtons" });
  buttons.forEach((b, i) => {
    const n = String(i + 1);
    if (!b.text.trim() || b.text.length > LIMITS.buttonText)
      out.push({ key: "metaErrButtonText", values: { n } });
    if (b.type === "URL" && !(URL.test(b.url ?? "") && !b.url?.includes("{{")))
      out.push({ key: "metaErrButtonUrl", values: { n } });
    if (b.type === "PHONE_NUMBER" && !PHONE.test(b.phoneNumber ?? ""))
      out.push({ key: "metaErrButtonPhone", values: { n } });
  });
  if (buttons.filter((b) => b.type === "URL").length > LIMITS.urlButtons)
    out.push({ key: "metaErrUrlButtons" });
  if (
    buttons.filter((b) => b.type === "PHONE_NUMBER").length >
    LIMITS.phoneButtons
  )
    out.push({ key: "metaErrPhoneButtons" });
  let groups = 0;
  buttons.forEach((b, i) => {
    const quick = b.type === "QUICK_REPLY";
    if (i === 0 || quick !== (buttons[i - 1].type === "QUICK_REPLY")) groups++;
  });
  if (groups > 2) out.push({ key: "metaErrButtonGroups" });
  return out;
}

export type StatusTone = "green" | "blue" | "red" | "gray";

/** APPROVED green, under review blue, REJECTED red, everything else gray. */
export function statusTone(status: string): StatusTone {
  if (status === "APPROVED") return "green";
  if (status === "PENDING" || status === "IN_APPEAL") return "blue";
  if (status === "REJECTED") return "red";
  return "gray";
}

/** The Meta templates whose name, language or category contain every word of the query. */
export function matchTemplates(
  list: MetaTemplate[],
  query: string
): MetaTemplate[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  return list.filter((t) => {
    const text = `${t.name} ${t.language} ${t.category}`.toLowerCase();
    return words.every((w) => text.includes(w));
  });
}
