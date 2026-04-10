import type { IconType } from "react-icons";
import {
  HiOutlineArrowPath,
  HiOutlineChartBar,
  HiOutlineCog6Tooth,
  HiOutlineCpuChip,
  HiOutlineDocumentText,
  HiOutlineExclamationTriangle,
  HiOutlineMap,
  HiOutlineMapPin,
  HiOutlineShieldCheck,
  HiOutlineSquares2X2,
  HiOutlineTruck,
  HiOutlineUserGroup,
} from "react-icons/hi2";

/**
 * Allowlist of icons referenceable by name from `ams.fleet_special_views.icon`.
 *
 * Why an allowlist instead of dynamic imports:
 *   - Predictable bundle size — only icons the catalog actually uses ship.
 *   - Single source of truth for what an admin can pick from.
 *   - Typo-safe failure mode: unknown names fall back to a default icon
 *     (see resolveFleetViewIcon below) instead of crashing the page.
 *
 * To add a new icon: import it from react-icons and add a key here that
 * matches what the DB row's `icon` column will store.
 */
export const FLEET_VIEW_ICON_REGISTRY: Record<string, IconType> = {
  HiOutlineArrowPath,
  HiOutlineChartBar,
  HiOutlineCog6Tooth,
  HiOutlineCpuChip,
  HiOutlineDocumentText,
  HiOutlineExclamationTriangle,
  HiOutlineMap,
  HiOutlineMapPin,
  HiOutlineShieldCheck,
  HiOutlineSquares2X2,
  HiOutlineTruck,
  HiOutlineUserGroup,
};

const FALLBACK_ICON: IconType = HiOutlineSquares2X2;

/**
 * Resolve a DB icon name to a React component. Returns a safe fallback when
 * the name is missing from the registry — never throws — so a typo in the
 * DB never breaks the carousel render.
 */
export function resolveFleetViewIcon(name: string | null | undefined): IconType {
  if (!name) return FALLBACK_ICON;
  return FLEET_VIEW_ICON_REGISTRY[name] ?? FALLBACK_ICON;
}
