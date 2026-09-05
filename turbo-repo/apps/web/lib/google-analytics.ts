export function parseGoogleAnalyticsId(value: string | undefined) {
  if (!value || !/^G-[A-Z0-9]+$/.test(value) || /\s/.test(value)) {
    return undefined;
  }

  return value;
}
