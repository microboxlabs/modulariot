import { HiArrowRight } from "react-icons/hi";
import { pages } from "@/features/layout/models/pages";
import { trDynamic } from "@/features/i18n/tr.service";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import type { SpotlightItem } from "./types";

export type CanAccessFn = (requiredGroups: string[], blockedGroups: string[]) => boolean;

/**
 * Builds the full flat list of navigate items from the static pages registry.
 *
 * Emits two row kinds:
 *  - **Group header** (`isGroupHeader: true`): one per parent page that has
 *    accessible children. Shown as a visual divider, not keyboard-selectable.
 *  - **Child item**: individual navigable pages carrying a `sublabel` (parent
 *    name) so results can be grouped without needing a separate data structure.
 *
 * Direct top-level pages (own `href`, no children) are emitted as regular items
 * with no `sublabel`.
 */
export function buildNavigateItems(
  sidebarLabels: I18nRecord,
  onNavigate: (href: string) => void,
  canAccess: CanAccessFn = () => true,
): SpotlightItem[] {
  const items: SpotlightItem[] = [];

  for (const page of pages) {
    if (!canAccess(page.requiredGroups ?? [], page.blockedGroups ?? [])) continue;

    const accessibleChildren = (page.items ?? []).filter(
      (child) =>
        child.href &&
        canAccess(child.requiredGroups ?? [], child.blockedGroups ?? []),
    );

    if (accessibleChildren.length > 0) {
      const parentTranslated = sidebarLabels
        ? trDynamic(page.label, sidebarLabels)
        : page.label;

      items.push({
        id: `navigate:parent:${page.label}`,
        label: parentTranslated,
        kind: "navigate",
        keywords: [parentTranslated.toLowerCase(), page.label.toLowerCase()],
        onSelect: () => {},
        isGroupHeader: true,
      });

      for (const child of accessibleChildren) {
        const childTranslated = sidebarLabels
          ? trDynamic(child.label, sidebarLabels)
          : child.label;

        items.push({
          id: `navigate:${child.label}`,
          label: childTranslated,
          sublabel: parentTranslated,
          kind: "navigate",
          icon: HiArrowRight,
          keywords: [
            childTranslated.toLowerCase(),
            child.label.toLowerCase(),
            parentTranslated.toLowerCase(),
          ],
          onSelect: () => onNavigate(child.href!),
        });
      }
    } else if (page.href) {
      const translated = sidebarLabels
        ? trDynamic(page.label, sidebarLabels)
        : page.label;

      items.push({
        id: `navigate:${page.label}`,
        label: translated,
        kind: "navigate",
        icon: HiArrowRight,
        keywords: [translated.toLowerCase(), page.label.toLowerCase()],
        onSelect: () => onNavigate(page.href!),
      });
    }
  }

  return items;
}
