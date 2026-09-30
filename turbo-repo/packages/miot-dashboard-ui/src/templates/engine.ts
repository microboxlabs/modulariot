import Handlebars from "handlebars";
import { registerTemplateHelpers } from "./helpers";

export interface TemplateField {
  id: string;
  template: string;
}
export interface TemplateEngineOptions {
  helpers?: Record<string, Handlebars.HelperDelegate>;
}
export type CompiledTemplate = (context: Record<string, unknown>) => string;

/** A host-owned helper registry. Does not modify the shared Handlebars instance. */
export function createTemplateEngine(options: TemplateEngineOptions = {}) {
  const runtime = Handlebars.create();
  registerTemplateHelpers(runtime);
  if (options.helpers) runtime.registerHelper(options.helpers);
  const compile = (template: string): CompiledTemplate => {
    // compile is lazy; parse validates once and reuses the parsed syntax tree.
    const compiled = runtime.compile(runtime.parse(template));
    return (context) =>
      compiled(context, {
        allowProtoMethodsByDefault: false,
        allowProtoPropertiesByDefault: false,
      });
  };
  const compileTemplates = (fields: readonly TemplateField[]) => {
    const compiled = new Map<string, CompiledTemplate>();
    for (const { id, template } of fields) {
      if (!template.includes("{{")) continue;
      try {
        compiled.set(id, compile(template));
      } catch {
        /* Host fallback handles invalid syntax. */
      }
    }
    return compiled;
  };
  const resolveTemplate = (
    compiled: ReadonlyMap<string, CompiledTemplate>,
    id: string,
    context: Record<string, unknown>,
    fallback: string,
  ): string => {
    const template = compiled.get(id);
    if (!template) return fallback;
    try {
      return template(context);
    } catch {
      return fallback;
    }
  };
  const resolveField = (
    template: string,
    context: Record<string, unknown>,
  ): string => {
    try {
      return compile(template)(context);
    } catch {
      return template;
    }
  };
  return { compileTemplates, resolveTemplate, resolveField };
}

export function buildDataProviderContext(
  entries: readonly { key: string; value: string }[],
) {
  return {
    data_provider: Object.fromEntries(
      entries
        .filter((entry) => entry.key)
        .map((entry) => [entry.key, entry.value]),
    ),
  };
}
