import type { ModelsInfo } from "@microboxlabs/miot-harness-client";

/** `/model default` clears the session model so the harness default applies. */
export const DEFAULT_MODEL_ARG = "default";

/** Text for `/model` with no argument: the harness models, marking the
 * default and the one in use. */
export function formatModels(
  info: ModelsInfo,
  current: string | null,
): string {
  if (info.models.length === 0) {
    return "the harness offers no model choice";
  }
  const lines = info.models.map((name) => {
    const tags: string[] = [];
    if (name === info.default) tags.push("default");
    if (name === current) tags.push("current");
    return tags.length > 0 ? `  • ${name} (${tags.join(", ")})` : `  • ${name}`;
  });
  const footer =
    current === null
      ? "using the harness default; set one with /model <name>"
      : `using ${current}; /model ${DEFAULT_MODEL_ARG} returns to the harness default`;
  return [`models (${info.models.length}):`, ...lines, footer].join("\n");
}

/** Returns an error message when `name` is not one of the harness models,
 * or null when it is. */
export function checkModel(info: ModelsInfo, name: string): string | null {
  if (info.models.length === 0) {
    return "the harness offers no model choice";
  }
  if (!info.models.includes(name)) {
    return `unknown model: ${name} (available: ${info.models.join(", ")})`;
  }
  return null;
}
