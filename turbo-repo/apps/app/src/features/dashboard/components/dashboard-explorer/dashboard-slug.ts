/** The dashboard server's id for a name: lowercase ASCII letters, digits and hyphens, at most 80. */
export function serverDashboardSlug(name: string): string {
  return name
    .normalize("NFD")
    .replaceAll(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, "-")
    .replace(/^-/, "")
    .slice(0, 80)
    .replace(/-$/, "");
}
