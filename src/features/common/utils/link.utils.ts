export function removeDotFromLink(href: string): string {
  if (href.startsWith(".")) {
    return href.substring(1);
  }
  return href;
}
