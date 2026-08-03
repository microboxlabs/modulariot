"use client";

import { TemplateInput } from "@/features/common/templating/template-input";
import type { HbNamespace } from "@/features/dashboard/dashlets/common/use-hb-autocomplete";
import { VARIABLE_GROUPS } from "./review-integration.types";

/**
 * The review drawer's mapping field: the shared {@link TemplateInput} bound to
 * the review context's namespaces (task, content, review, session). Kept as a
 * named component so the drawer's call sites stay declarative; everything
 * behavioural lives in the shared input.
 */

/** Each context object and the fields it offers, from the single variable catalog. */
const NAMESPACES: HbNamespace[] = VARIABLE_GROUPS.map((group) => ({
  prefix: group.id,
  suggestions: group.variables.map((variable) =>
    variable.path.slice(group.id.length + 1)
  ),
}));

interface ReviewTemplateInputProps {
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly placeholder?: string;
  readonly color?: "gray" | "success" | "failure";
}

export function ReviewTemplateInput({
  value,
  onChange,
  placeholder,
  color = "gray",
}: Readonly<ReviewTemplateInputProps>) {
  return (
    <TemplateInput
      value={value}
      onChange={onChange}
      namespaces={NAMESPACES}
      placeholder={placeholder}
      color={color}
    />
  );
}
