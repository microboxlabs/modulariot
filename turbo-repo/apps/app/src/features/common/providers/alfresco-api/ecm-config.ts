/**
 * Whether this deployment has Alfresco (ECM). Deployments without it leave
 * `ECM_API_URL` unset; the routes the page frame calls on every load then
 * answer empty instead of failing, and `/app` lands on the control tower.
 */
export function isEcmConfigured(): boolean {
  return Boolean(process.env.ECM_API_URL?.trim());
}

/** Where `/app` lands: `APP_HOME_PATH`, else the kanban with Alfresco, else the control tower. */
export function homePath(): string {
  const configured = process.env.APP_HOME_PATH?.trim();
  // "/" is the landing request itself; using it would redirect forever.
  if (configured?.startsWith("/") && configured.length > 1) return configured;
  return isEcmConfigured() ? "/shipping" : "/symptoms";
}
