import { I18nRecord } from "./i18n.service.types";

export function tr(
  path: string,
  dictionary: I18nRecord,
  params?: Record<string, string>,
): string {
  const keys = path.split(".");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let value: any = dictionary;
  for (const key of keys) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
    value = value[key];
    if (!value) {
      return path;
    }
  }

  if (typeof value === "object") {
    return path;
  }

  return Object.entries(params ?? {}).reduce(
    (acc, [key, value]) => acc.replace(`{${key}}`, value),
    value as string,
  );
}
