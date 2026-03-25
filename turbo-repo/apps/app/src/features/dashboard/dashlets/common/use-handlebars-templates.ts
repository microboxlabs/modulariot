import Handlebars from "handlebars";
import type { DataProviderEntry } from "../types";

// ============================================================================
// Types
// ============================================================================

export interface TemplateField {
  id: string;
  template: string;
}

// ============================================================================
// Functions
// ============================================================================

/**
 * Compile template strings that contain "{{", returning a Map<id, TemplateDelegate>.
 * Invalid templates are silently skipped.
 */
export function compileTemplates(
  fields: TemplateField[]
): Map<string, Handlebars.TemplateDelegate> {
  const map = new Map<string, Handlebars.TemplateDelegate>();
  for (const { id, template } of fields) {
    if (template.includes("{{")) {
      try {
        map.set(id, Handlebars.compile(template));
      } catch {
        // Invalid template — skip; caller will use fallback
      }
    }
  }
  return map;
}

/**
 * Resolve a compiled template by id with context; returns fallback on miss/error.
 */
export function resolveTemplate(
  compiled: Map<string, Handlebars.TemplateDelegate>,
  id: string,
  context: Record<string, unknown>,
  fallback: string
): string {
  const tpl = compiled.get(id);
  if (!tpl) return fallback;
  try {
    return tpl(context);
  } catch {
    return fallback;
  }
}

/**
 * Compile + resolve a single template string with context.
 * Returns the raw string on error.
 */
export function resolveHandlebarsField(
  template: string,
  context: Record<string, unknown>
): string {
  try {
    return Handlebars.compile(template)(context);
  } catch {
    return template;
  }
}

/**
 * Build {data_provider: {...}} context from DataProviderEntry[].
 * Used by info_card, stat_status, and other dashlets with data providers.
 */
export function buildDataProviderContext(
  entries: DataProviderEntry[]
): { data_provider: Record<string, string> } {
  const data_provider: Record<string, string> = {};
  for (const entry of entries) {
    if (entry.key) {
      data_provider[entry.key] = entry.value;
    }
  }
  return { data_provider };
}
