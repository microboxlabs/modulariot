import { normalizeScalarColorRules } from "./scalar-color-rules";
export function normalizeTargetedColorRules(
  raw: unknown,
  targets: readonly string[],
) {
  if (
    !raw ||
    typeof raw !== "object" ||
    !("rules" in raw) ||
    !Array.isArray(raw.rules)
  )
    return [];
  return raw.rules.flatMap((entry: unknown) => {
    const rule = normalizeScalarColorRules({ rules: [entry] })[0];
    if (rule?.color.length !== 6 || !entry || typeof entry !== "object")
      return [];
    const requested =
      "targets" in entry && Array.isArray(entry.targets)
        ? entry.targets
        : ["target" in entry ? entry.target : "text"];
    const selected = targets.filter((target) => requested.includes(target));
    return [{ ...rule, targets: selected.length ? selected : ["text"] }];
  });
}
