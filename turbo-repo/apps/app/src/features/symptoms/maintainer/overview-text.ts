import type { LevelResponse, SymptomSpec } from "./maintainer-api";

/** The longest rule text the describe endpoint takes. */
const MAX_CHARS = 4000;

function responds(response: LevelResponse | null | undefined): string {
  if (!response?.operator) return "sin operador";
  return response.slaMinutes == null
    ? "operador"
    : `operador ${response.slaMinutes} min`;
}

/**
 * The whole symptom as the text the Harness summarizes in one sentence: one
 * line each for the activation, the measure, every level that applies with who
 * responds, and when a case opens and closes. Empty when there is nothing to
 * describe or the text is too long to send.
 */
export function overviewText(spec: SymptomSpec): string {
  if (!spec.activation?.trim()) return "";
  const lines = [`activa: ${spec.activation}`];
  const measure = spec.measure;
  if (measure?.expression) {
    const unit = measure.unit ? ` (${measure.unit})` : "";
    lines.push(`medida: ${measure.expression}${unit}`);
  }
  for (const level of [...(spec.levels ?? [])].sort((a, b) => a.icu - b.icu)) {
    if (level.applies) {
      lines.push(
        `nivel ${level.icu}: ${level.when ?? ""} · ${responds(level.response)}`
      );
    }
  }
  if (spec.lifecycle?.open) lines.push(`abre: ${spec.lifecycle.open}`);
  if (spec.lifecycle?.close) lines.push(`cierra: ${spec.lifecycle.close}`);
  const text = lines.join("\n");
  return text.length > MAX_CHARS ? "" : text;
}
