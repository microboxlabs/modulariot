/** `/api/v1/platform/orgs/{slug}/{...segments}`, each segment encoded. */
export function platformOrgPath(slug: string, ...segments: string[]): string {
  return [
    "/api/v1/platform/orgs",
    encodeURIComponent(slug),
    ...segments.map((s) => encodeURIComponent(s)),
  ].join("/");
}

/** `?dryRun=true` when the request asks for a dry run, else nothing. */
export function dryRunQuery(request: Request): string {
  const dryRun = new URL(request.url).searchParams.get("dryRun") === "true";
  return dryRun ? "?dryRun=true" : "";
}
