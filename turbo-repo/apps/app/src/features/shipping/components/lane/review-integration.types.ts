import type { IconType } from "react-icons";
import {
  HiAnnotation,
  HiClipboardList,
  HiPhotograph,
  HiUser,
} from "react-icons/hi";

/**
 * Review-process integration — the mockup model.
 *
 * A kanban column can be turned into a *reviewed* stage: when a service in it is
 * approved or rejected, the verdict is pushed to an external channel. This is the
 * standardization the operator asked for — the same review plumbing behind any
 * channel — so the shapes are channel-first:
 *
 *   channel (what to talk to) → credential (how to authenticate) → mapping (a
 *   Handlebars template per channel field, over the task/content/review/session
 *   objects) → an async job that carries it.
 *
 * The mapping is Handlebars, matching how the dashboard dashlets template their
 * data. Each channel field holds a template string like
 * `{{content.integrationMediaId}}`, rendered against a context assembled from the
 * task metadata, the ingested document, the review outcome and the session user.
 *
 * Everything is client-only for now (persisted in localStorage). Swapping onto
 * the real API later means feeding a saved-credentials list into the picker and
 * posting this config to the backend that registers the async job.
 *
 * Public repo: the concrete partner (name, endpoint) stays runtime config. The
 * channel here is a generic "Partner API".
 */

/* -------------------------------------------------------------------------- */
/* Variable catalog — the objects a template can read                          */
/* -------------------------------------------------------------------------- */

export type VariableGroupId =
  | "task"
  | "content"
  | "review"
  | "session"
  | "reasons";

export interface TemplateVariable {
  /** Dotted path without braces, e.g. `task.mintral_serviceCode`. */
  readonly path: string;
  /** i18n key under `variables.<group>`. */
  readonly labelKey: string;
  /** Value used to render the live preview. */
  readonly sample: string;
}

export interface VariableGroup {
  readonly id: VariableGroupId;
  /** i18n key under `variables.groups`. */
  readonly labelKey: string;
  readonly icon: IconType;
  readonly variables: readonly TemplateVariable[];
  /**
   * True when the group exists only while an array field renders, rather than for the whole
   * payload. A contract declares these by iterating a collection, so they are offered per
   * row rather than listed as always available.
   */
  readonly scoped?: boolean;
}

/**
 * The objects a mapping can pull from — the context the producer actually sends.
 *
 * `content.*` is **one reviewed item**: an array contract renders the mapped fields
 * once per element, binding `content` to each in turn, so `{{content.mediaId}}` means
 * "this item's media id". That is why the per-item verdict lives here rather than under a
 * `review` object — a single task completion can carry several media with different
 * outcomes.
 *
 * An envelope field sits outside that array and so has no "this item" to read. For those,
 * `task.approved` carries the rollup across the whole task. The mapping language is plain
 * substitution — no helpers, no folds — so a whole-task answer has to arrive as a whole-task
 * field; the producer computes it once and every channel reads the same fact.
 *
 * `review` remains a legal root server-side (so a hand-written `{{review.x}}` is not
 * rejected), but nothing populates it today, which is why it is not offered here.
 *
 * **This list must track what the producer emits.** It drifted once already: ECM began
 * sending `task.approved` and the drawer went on refusing to autocomplete it, so the one
 * field that answers "was the whole service approved" looked unavailable.
 *
 * Samples are deliberately generic — this is a public repo, so no real client, tenant
 * or contact data appears.
 */
export const VARIABLE_GROUPS: readonly VariableGroup[] = [
  {
    id: "task",
    labelKey: "variables.groups.task",
    icon: HiClipboardList,
    variables: [
      { path: "task.serviceCode", labelKey: "variables.task.serviceCode", sample: "1649906" },
      { path: "task.formKey", labelKey: "variables.task.formKey", sample: "wfship2:missionControlTask" },
      { path: "task.outcome", labelKey: "variables.task.outcome", sample: "monitorTripInCourse" },
      // The rollup across every reviewed item: false as soon as one is rejected. Task-scoped
      // rather than under `content`, because `content.*` is a single item — an envelope field
      // needs the whole-task answer, and the producer computes it once so every channel agrees.
      { path: "task.approved", labelKey: "variables.task.approved", sample: "false" },
    ],
  },
  {
    id: "content",
    labelKey: "variables.groups.content",
    icon: HiPhotograph,
    variables: [
      { path: "content.mediaId", labelKey: "variables.content.mediaId", sample: "19f8f3a89a1-a8ad5969" },
      { path: "content.verdict", labelKey: "variables.content.verdict", sample: "false" },
      { path: "content.reviewStatus", labelKey: "variables.content.reviewStatus", sample: "REJECTED" },
      { path: "content.comment", labelKey: "variables.content.comment", sample: "Falta señalética en la carga" },
      { path: "content.contentType", labelKey: "variables.content.contentType", sample: "PICKUP_FRONT_IMAGE" },
      { path: "content.reviewedBy", labelKey: "variables.content.reviewedBy", sample: "revisor.demo" },
    ],
  },
  {
    id: "session",
    labelKey: "variables.groups.session",
    icon: HiUser,
    variables: [
      { path: "session.reviewer", labelKey: "variables.session.reviewer", sample: "revisor.demo" },
    ],
  },
  {
    // In scope only inside an array that iterates a reviewed item's reasons: the renderer
    // rebinds each element under the last segment of `itemsFrom`, so `content.reasons`
    // becomes `{{reasons.*}}` — *this* item's reasons rather than a list across the task.
    // Present only when a rejection carried reasons, so a template reading it renders empty
    // for an approved item.
    id: "reasons",
    labelKey: "variables.groups.reasons",
    icon: HiAnnotation,
    scoped: true,
    variables: [
      { path: "reasons.code", labelKey: "variables.reasons.code", sample: "poor_image_quality" },
      { path: "reasons.name", labelKey: "variables.reasons.name", sample: "Calidad de imagen deficiente" },
      {
        path: "reasons.description",
        labelKey: "variables.reasons.description",
        sample: "La foto no permite verificar el sello",
      },
    ],
  },
];

/** The always-available groups — the ones a template may read anywhere in the payload. */
export const GLOBAL_VARIABLE_GROUPS: readonly VariableGroup[] = VARIABLE_GROUPS.filter(
  (group) => !group.scoped
);

/**
 * Roots that exist only as an array element's bind name.
 *
 * Legal in a *value* row inside that array, never legal as the array's source: `reasons` is
 * what an element becomes, not where it came from.
 */
export const ELEMENT_ROOTS: readonly string[] = VARIABLE_GROUPS.filter(
  (group) => group.scoped
).map((group) => group.id);

/* -------------------------------------------------------------------------- */
/* Collections — the arrays a collection row can point at                      */
/* -------------------------------------------------------------------------- */

export interface CollectionVariable {
  /** Dotted path to the array, written in the scope it is reachable from. */
  readonly path: string;
  /** i18n key under `variables.collections`. */
  readonly labelKey: string;
  /** The root its elements are rebound under — what the rows inside it read. */
  readonly binds: VariableGroupId;
  /** The bind name of the array this one sits inside, or null at the envelope. */
  readonly within: VariableGroupId | null;
}

/**
 * Where an array's elements can come from.
 *
 * A collection row asks a different question from every other row — not "what value goes
 * here" but "which array does this repeat over" — and the answer is a path in the *enclosing*
 * scope. A separate catalogue is what keeps the two apart: offered the value vocabulary, an
 * operator picks `{{reasons}}`, which resolves to nothing, renders an empty array, and is then
 * dropped from the payload altogether, because an unrequired empty array is omitted rather
 * than reported. That is a live integration shipping no rejection reasons at all, with every
 * check on screen green.
 */
export const COLLECTION_VARIABLES: readonly CollectionVariable[] = [
  { path: "content", labelKey: "variables.collections.content", binds: "content", within: null },
  // Reachable only from inside `content`, where the element is bound under that name — which
  // is also why it is spelled `content.reasons` rather than `reasons`.
  { path: "content.reasons", labelKey: "variables.collections.reasons", binds: "reasons", within: "content" },
];

/** The arrays reachable from a scope, null being the envelope. */
export function collectionsInScope(
  scope: string | null | undefined
): readonly CollectionVariable[] {
  const within = scope ?? null;
  return COLLECTION_VARIABLES.filter((collection) => collection.within === within);
}

/**
 * A worked example for one contract row: the first variable of the root that row renders
 * under, so the hint names a path that actually resolves there. Envelope rows see the whole
 * context, so they get the most common starting point instead.
 */
export function sampleTemplateFor(contextRoot: string | null | undefined): string {
  const group = VARIABLE_GROUPS.find((candidate) => candidate.id === contextRoot);
  const path = group?.variables[0]?.path ?? "task.serviceCode";
  return `{{${path}}}`;
}

/**
 * The context a template renders against, built from every variable's sample and
 * nested by group (`{ task: {...}, content: {...}, ... }`). Stands in for the
 * runtime payload the backend will assemble per event.
 */
export function buildSampleContext(): Record<string, Record<string, string>> {
  const context: Record<string, Record<string, string>> = {};
  for (const group of VARIABLE_GROUPS) {
    const bucket: Record<string, string> = {};
    for (const variable of group.variables) {
      const key = variable.path.slice(group.id.length + 1); // strip "group."
      bucket[key] = variable.sample;
    }
    context[group.id] = bucket;
  }
  return context;
}

/** Resolves a dotted path such as `content.mediaId` against the context. */
function resolvePath(path: string, context: Record<string, unknown>): unknown {
  let current: unknown = context;
  for (const segment of path.split(".")) {
    if (typeof current !== "object" || current === null) return undefined;
    current = (current as Record<string, unknown>)[segment];
    if (current === undefined || current === null) return undefined;
  }
  return current;
}

/**
 * Renders a template for the preview: literal text with `{{dotted.path}}` variables
 * substituted from the context. A path that resolves to nothing becomes empty.
 *
 * Deliberately the same substitution subset the backend implements, rather than a
 * full Handlebars engine. Previewing with more power than the server has would let
 * the drawer show `{{#if}}` working on a template the server then refuses to store —
 * the exact divergence this feature exists to prevent. It also means no escaping
 * decision arises here: the value is inserted as text and React escapes it on render,
 * whereas HTML-escaping it would misreport the JSON the partner actually receives.
 */
export function renderTemplate(
  template: string,
  context: Record<string, unknown>
): string {
  if (!template) return "";
  return template.replace(/\{\{([^{}]*)\}\}/g, (whole, rawPath: string) => {
    const path = rawPath.trim();
    // Anything that is not a plain path (a helper, a block) is left verbatim, which
    // is what the operator needs to see: the server will reject it on save.
    if (!/^\w+(\.\w+)*$/.test(path)) return whole;
    const value = resolvePath(path, context);
    if (value === undefined) return "";
    if (typeof value === "string") return value;
    if (typeof value === "number" || typeof value === "boolean") return String(value);
    // A path that lands on a whole object — `{{task}}` rather than `{{task.code}}` —
    // is left verbatim too. Stringifying it would preview "[object Object]" for a
    // template the server rejects outright, which is the divergence to avoid.
    return whole;
  });
}
