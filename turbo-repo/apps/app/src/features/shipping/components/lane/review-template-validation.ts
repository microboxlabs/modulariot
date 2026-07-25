/**
 * Validates a mapping template against the exact subset the server accepts.
 *
 * This deliberately does **not** use the Handlebars engine the dashboard inputs use.
 * `Handlebars.compile("{{#if x}}")` succeeds, so a generic validator would paint a
 * template green that `PayloadTemplate.validate` then refuses to store — the same
 * preview-stronger-than-the-server divergence the renderer already avoids. The rules
 * below mirror `PayloadTemplate.parse`/`validate` one for one; if that relaxes (real
 * helpers, say), relax this in the same change.
 */

/** The context objects a template may read — mirrors `PayloadTemplate.DEFAULT_ROOTS`. */
export const ALLOWED_ROOTS: readonly string[] = ["task", "content", "review", "session"];

/** Stashes that open a block, partial, comment or delimiter change. */
const NON_VARIABLE_PREFIXES = "#/^>!&=";

export type TemplateStatus = "valid" | "invalid" | "none";

/** A problem, as a code plus its substitutions, so the UI can translate it. */
export interface TemplateProblem {
  readonly code:
    | "unescaped"
    | "unclosed"
    | "empty"
    | "notPlain"
    | "helperCall"
    | "badPath"
    | "badChar"
    | "unknownRoot"
    | "wholeObject";
  readonly params?: Readonly<Record<string, string>>;
}

export interface TemplateCheck {
  readonly status: TemplateStatus;
  /** The first problem found; absent when the template is usable. */
  readonly problem?: TemplateProblem;
  /** Every variable path the template reads, in order. */
  readonly paths: readonly string[];
}

const OK = (paths: string[]): TemplateCheck => ({
  status: paths.length > 0 ? "valid" : "none",
  paths,
});

const FAIL = (
  code: TemplateProblem["code"],
  params?: Record<string, string>
): TemplateCheck => ({ status: "invalid", problem: { code, params }, paths: [] });

/**
 * @param allowedRoots the context objects in scope, or **null** when the contract's set is
 *        unknown. A contract's arrays introduce roots the static list cannot predict
 *        (`{{reasons.*}}` inside a `content.reasons` array), and only the server derives
 *        them from the schema. With null the unknown-root rule is skipped rather than
 *        guessed, because guessing rejects mappings the server stores — and the server
 *        validates on save regardless, so nothing unsafe gets through. Every other rule is
 *        pure syntax and still applies.
 * @returns `none` for a template with no variables (plain literal text is legal), and
 *          the first reason the server would reject it otherwise
 */
export function checkTemplate(
  template: string,
  allowedRoots: readonly string[] | null = ALLOWED_ROOTS
): TemplateCheck {
  if (!template) return OK([]);

  const paths: string[] = [];
  let cursor = 0;

  while (cursor < template.length) {
    const open = template.indexOf("{{", cursor);
    if (open < 0) break;

    // `{{{raw}}}` skips escaping in Handlebars. The server never escapes, so accepting
    // it here would quietly mean something other than what was previewed.
    if (template.startsWith("{{{", open)) return FAIL("unescaped");

    const close = template.indexOf("}}", open + 2);
    if (close < 0) return FAIL("unclosed");

    const problem = checkStash(template.slice(open + 2, close), allowedRoots, paths);
    if (problem) return problem;

    cursor = close + 2;
  }

  return OK(paths);
}

/** Validates one `{{…}}` stash, pushing its path when usable. */
function checkStash(
  raw: string,
  allowedRoots: readonly string[] | null,
  paths: string[]
): TemplateCheck | null {
  const inner = raw.trim();
  if (!inner) return FAIL("empty");

  if (NON_VARIABLE_PREFIXES.includes(inner[0])) {
    return FAIL("notPlain", { expression: inner });
  }
  // Whitespace survives the trim only between tokens — i.e. a helper call.
  if (/\s/.test(inner)) return FAIL("helperCall", { expression: inner });

  if (inner.startsWith(".") || inner.endsWith(".") || inner.includes("..")) {
    return FAIL("badPath", { expression: inner });
  }
  const badChar = /[^A-Za-z0-9_.]/.exec(inner);
  if (badChar) return FAIL("badChar", { expression: inner, char: badChar[0] });

  const dot = inner.indexOf(".");
  const root = dot < 0 ? inner : inner.slice(0, dot);
  if (allowedRoots && !allowedRoots.includes(root)) {
    return FAIL("unknownRoot", {
      path: inner,
      root,
      roots: [...allowedRoots].sort((a, b) => a.localeCompare(b)).join(", "),
    });
  }
  // `{{task}}` would stringify a whole object into the payload — almost always a
  // half-typed path rather than an intent.
  if (dot < 0) return FAIL("wholeObject", { path: inner });

  paths.push(inner);
  return null;
}
