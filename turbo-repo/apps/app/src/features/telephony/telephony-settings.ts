/** Ajustes › Síntomas › Telefonía, where the organization chooses its line. */
export function telephonySettingsHref(lang: string | undefined): string {
  const path = "/users/settings/symptoms?section=telephony";
  return lang ? `/${lang}${path}` : path;
}
