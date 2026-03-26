import type { DynamicFormConfig } from "@/features/dynamic-forms";

export const CREATE_DASHBOARD_FORM_CONFIG: DynamicFormConfig = {
  fields: [
    {
      name: "name",
      labelKey: "dashboard.create.nameLabel",
      type: "text",
      required: true,
      placeholder: "My Dashboard",
    },
  ],
};

/**
 * Generate a URL-safe slug from a dashboard name.
 * Lowercase, spaces→hyphens, strip unsafe chars, max 50 chars.
 */
export function generateSlug(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replaceAll(/\s+/g, "-")
    .replaceAll(/[^a-z0-9_-]/g, "")
    .substring(0, 50);
}
