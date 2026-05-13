/**
 * Icon Registry – curated list of icons available in the icon picker.
 *
 * Each entry maps a stable key to:
 *  - label: human-friendly name shown on hover
 *  - load: dynamic import that tree-shakes unused icons from the bundle
 *
 * Only the icons actually rendered on the page get loaded.
 */

import type { ComponentType } from "react";

export interface IconRegistryEntry {
  label: string;
  load: () => Promise<{ default: ComponentType<{ className?: string }> }>;
}

/**
 * Wrap a named export from react-icons into a default-style dynamic import.
 */
function ri(
  importFn: () => Promise<Record<string, unknown>>,
  name: string
): () => Promise<{ default: ComponentType<{ className?: string }> }> {
  return async () => {
    const mod = await importFn();
    const Icon = mod[name] as ComponentType<{ className?: string }> | undefined;
    if (!Icon) throw new Error(`Icon "${name}" not found in module`);
    return { default: Icon };
  };
}

/* ─── Hi2 (Heroicons 2 – outline & solid) ─── */
const hi2 = () => import("react-icons/hi2");

/* ─── Tb (Tabler Icons) ─── */
const tb = () => import("react-icons/tb");

/* ─── Io5 (Ionicons 5) ─── */
const io5 = () => import("react-icons/io5");

/* ─── Registry ─── */
export const ICON_REGISTRY: Record<string, IconRegistryEntry> = {
  // General
  "hi2-chart-bar": { label: "Chart Bar", load: ri(hi2, "HiChartBar") },
  "hi2-chart-pie": { label: "Chart Pie", load: ri(hi2, "HiChartPie") },
  "hi2-currency-dollar": { label: "Currency Dollar", load: ri(hi2, "HiCurrencyDollar") },
  "hi2-users": { label: "Users", load: ri(hi2, "HiUsers") },
  "hi2-user": { label: "User", load: ri(hi2, "HiUser") },
  "hi2-user-circle": { label: "User Circle", load: ri(hi2, "HiUserCircle") },
  "hi2-shopping-cart": { label: "Shopping Cart", load: ri(hi2, "HiShoppingCart") },
  "hi2-clock": { label: "Clock", load: ri(hi2, "HiClock") },
  "hi2-check-circle": { label: "Check Circle", load: ri(hi2, "HiCheckCircle") },
  "hi2-check": { label: "Check", load: ri(hi2, "HiCheck") },
  "hi2-x-mark": { label: "X Mark", load: ri(hi2, "HiXMark") },
  "hi2-x-circle": { label: "X Circle", load: ri(hi2, "HiXCircle") },
  "hi2-information-circle": { label: "Info Circle", load: ri(hi2, "HiInformationCircle") },
  "hi2-exclamation-triangle": { label: "Warning", load: ri(hi2, "HiExclamationTriangle") },
  "hi2-exclamation-circle": { label: "Exclamation Circle", load: ri(hi2, "HiExclamationCircle") },

  // Objects
  "hi2-cube": { label: "Cube", load: ri(hi2, "HiCube") },
  "hi2-truck": { label: "Truck", load: ri(hi2, "HiTruck") },
  "hi2-bolt": { label: "Bolt", load: ri(hi2, "HiBolt") },
  "hi2-fire": { label: "Fire", load: ri(hi2, "HiFire") },
  "hi2-heart": { label: "Heart", load: ri(hi2, "HiHeart") },
  "hi2-star": { label: "Star", load: ri(hi2, "HiStar") },
  "hi2-bell": { label: "Bell", load: ri(hi2, "HiBell") },
  "hi2-bell-alert": { label: "Bell Alert", load: ri(hi2, "HiBellAlert") },
  "hi2-gift": { label: "Gift", load: ri(hi2, "HiGift") },
  "hi2-key": { label: "Key", load: ri(hi2, "HiKey") },
  "hi2-lock-closed": { label: "Lock", load: ri(hi2, "HiLockClosed") },
  "hi2-lock-open": { label: "Lock Open", load: ri(hi2, "HiLockOpen") },

  // Communication
  "hi2-envelope": { label: "Envelope", load: ri(hi2, "HiEnvelope") },
  "hi2-phone": { label: "Phone", load: ri(hi2, "HiPhone") },
  "hi2-chat-bubble-left": { label: "Chat", load: ri(hi2, "HiChatBubbleLeft") },
  "hi2-megaphone": { label: "Megaphone", load: ri(hi2, "HiMegaphone") },

  // Navigation / UI
  "hi2-home": { label: "Home", load: ri(hi2, "HiHome") },
  "hi2-cog-6-tooth": { label: "Settings", load: ri(hi2, "HiCog6Tooth") },
  "hi2-adjustments-horizontal": { label: "Adjustments", load: ri(hi2, "HiAdjustmentsHorizontal") },
  "hi2-magnifying-glass": { label: "Search", load: ri(hi2, "HiMagnifyingGlass") },
  "hi2-funnel": { label: "Filter", load: ri(hi2, "HiFunnel") },
  "hi2-arrows-pointing-out": { label: "Expand", load: ri(hi2, "HiArrowsPointingOut") },
  "hi2-arrow-path": { label: "Refresh", load: ri(hi2, "HiArrowPath") },
  "hi2-arrow-trending-up": { label: "Trending Up", load: ri(hi2, "HiArrowTrendingUp") },
  "hi2-arrow-trending-down": { label: "Trending Down", load: ri(hi2, "HiArrowTrendingDown") },

  // Data / Content
  "hi2-document": { label: "Document", load: ri(hi2, "HiDocument") },
  "hi2-document-text": { label: "Document Text", load: ri(hi2, "HiDocumentText") },
  "hi2-clipboard": { label: "Clipboard", load: ri(hi2, "HiClipboard") },
  "hi2-folder": { label: "Folder", load: ri(hi2, "HiFolder") },
  "hi2-archive-box": { label: "Archive", load: ri(hi2, "HiArchiveBox") },
  "hi2-calendar": { label: "Calendar", load: ri(hi2, "HiCalendar") },
  "hi2-calculator": { label: "Calculator", load: ri(hi2, "HiCalculator") },
  "hi2-table-cells": { label: "Table", load: ri(hi2, "HiTableCells") },

  // IoT / Tech
  "hi2-cpu-chip": { label: "CPU Chip", load: ri(hi2, "HiCpuChip") },
  "hi2-signal": { label: "Signal", load: ri(hi2, "HiSignal") },
  "hi2-wifi": { label: "WiFi", load: ri(hi2, "HiWifi") },
  "hi2-globe-alt": { label: "Globe", load: ri(hi2, "HiGlobeAlt") },
  "hi2-server": { label: "Server", load: ri(hi2, "HiServer") },
  "hi2-cloud": { label: "Cloud", load: ri(hi2, "HiCloud") },
  "hi2-battery-50": { label: "Battery", load: ri(hi2, "HiBattery50") },
  "hi2-light-bulb": { label: "Light Bulb", load: ri(hi2, "HiLightBulb") },
  "hi2-beaker": { label: "Beaker", load: ri(hi2, "HiBeaker") },
  "hi2-wrench": { label: "Wrench", load: ri(hi2, "HiWrench") },
  "hi2-wrench-screwdriver": { label: "Tools", load: ri(hi2, "HiWrenchScrewdriver") },

  // Status / Progress
  "hi2-shield-check": { label: "Shield Check", load: ri(hi2, "HiShieldCheck") },
  "hi2-shield-exclamation": { label: "Shield Warning", load: ri(hi2, "HiShieldExclamation") },
  "hi2-eye": { label: "Eye", load: ri(hi2, "HiEye") },
  "hi2-eye-slash": { label: "Eye Off", load: ri(hi2, "HiEyeSlash") },
  "hi2-flag": { label: "Flag", load: ri(hi2, "HiFlag") },
  "hi2-tag": { label: "Tag", load: ri(hi2, "HiTag") },
  "hi2-bookmark": { label: "Bookmark", load: ri(hi2, "HiBookmark") },

  // Maps / Location
  "hi2-map-pin": { label: "Map Pin", load: ri(hi2, "HiMapPin") },
  "hi2-map": { label: "Map", load: ri(hi2, "HiMap") },
  "hi2-building-office": { label: "Building", load: ri(hi2, "HiBuildingOffice") },

  // Media
  "hi2-photo": { label: "Photo", load: ri(hi2, "HiPhoto") },
  "hi2-camera": { label: "Camera", load: ri(hi2, "HiCamera") },
  "hi2-speaker-wave": { label: "Speaker", load: ri(hi2, "HiSpeakerWave") },
  "hi2-video-camera": { label: "Video", load: ri(hi2, "HiVideoCamera") },

  // Actions
  "hi2-plus": { label: "Plus", load: ri(hi2, "HiPlus") },
  "hi2-minus": { label: "Minus", load: ri(hi2, "HiMinus") },
  "hi2-trash": { label: "Trash", load: ri(hi2, "HiTrash") },
  "hi2-pencil": { label: "Pencil", load: ri(hi2, "HiPencil") },
  "hi2-link": { label: "Link", load: ri(hi2, "HiLink") },
  "hi2-share": { label: "Share", load: ri(hi2, "HiShare") },
  "hi2-paper-airplane": { label: "Send", load: ri(hi2, "HiPaperAirplane") },
  "hi2-power": { label: "Power", load: ri(hi2, "HiPower") },
  "hi2-play": { label: "Play", load: ri(hi2, "HiPlay") },
  "hi2-pause": { label: "Pause", load: ri(hi2, "HiPause") },
  "hi2-stop": { label: "Stop", load: ri(hi2, "HiStop") },

  // Fleet Management (outline)
  "hi2-outline-truck": { label: "Truck (outline)", load: ri(hi2, "HiOutlineTruck") },
  "hi2-outline-check-circle": { label: "Check Circle (outline)", load: ri(hi2, "HiOutlineCheckCircle") },
  "hi2-outline-wrench-screwdriver": { label: "Tools (outline)", load: ri(hi2, "HiOutlineWrenchScrewdriver") },
  "hi2-outline-exclamation-triangle": { label: "Warning (outline)", load: ri(hi2, "HiOutlineExclamationTriangle") },
  "hi2-outline-no-symbol": { label: "No Symbol", load: ri(hi2, "HiOutlineNoSymbol") },
  "hi2-outline-arrow-path": { label: "Refresh (outline)", load: ri(hi2, "HiOutlineArrowPath") },
  "hi2-outline-chart-bar": { label: "Chart Bar (outline)", load: ri(hi2, "HiOutlineChartBar") },
  "hi2-outline-cog-6-tooth": { label: "Settings (outline)", load: ri(hi2, "HiOutlineCog6Tooth") },
  "hi2-outline-cpu-chip": { label: "CPU Chip (outline)", load: ri(hi2, "HiOutlineCpuChip") },
  "hi2-outline-document-text": { label: "Document (outline)", load: ri(hi2, "HiOutlineDocumentText") },
  "hi2-outline-map": { label: "Map (outline)", load: ri(hi2, "HiOutlineMap") },
  "hi2-outline-map-pin": { label: "Map Pin (outline)", load: ri(hi2, "HiOutlineMapPin") },
  "hi2-outline-shield-check": { label: "Shield Check (outline)", load: ri(hi2, "HiOutlineShieldCheck") },
  "hi2-outline-squares-2x2": { label: "Grid (outline)", load: ri(hi2, "HiOutlineSquares2X2") },
  "hi2-outline-user-group": { label: "User Group (outline)", load: ri(hi2, "HiOutlineUserGroup") },
  "hi2-outline-signal": { label: "Signal (outline)", load: ri(hi2, "HiOutlineSignal") },
  "hi2-outline-signal-slash": { label: "Signal Off (outline)", load: ri(hi2, "HiOutlineSignalSlash") },
  "hi2-outline-information-circle": { label: "Info (outline)", load: ri(hi2, "HiOutlineInformationCircle") },
  "hi2-outline-clock": { label: "Clock (outline)", load: ri(hi2, "HiOutlineClock") },
  "hi2-outline-bolt": { label: "Bolt (outline)", load: ri(hi2, "HiOutlineBolt") },
  "hi2-outline-fire": { label: "Fire (outline)", load: ri(hi2, "HiOutlineFire") },
  "hi2-outline-trophy": { label: "Trophy", load: ri(hi2, "HiOutlineTrophy") },
  "hi2-outline-sun": { label: "Sun", load: ri(hi2, "HiOutlineSun") },
  "hi2-outline-moon": { label: "Moon", load: ri(hi2, "HiOutlineMoon") },
  "hi2-outline-globe-americas": { label: "Globe Americas", load: ri(hi2, "HiOutlineGlobeAmericas") },
  "hi2-outline-building-office-2": { label: "Building (outline)", load: ri(hi2, "HiOutlineBuildingOffice2") },
  "hi2-outline-user": { label: "User (outline)", load: ri(hi2, "HiOutlineUser") },
  "hi2-outline-calendar-days": { label: "Calendar (outline)", load: ri(hi2, "HiOutlineCalendarDays") },
  "hi2-outline-camera": { label: "Camera (outline)", load: ri(hi2, "HiOutlineCamera") },
  "hi2-outline-share": { label: "Share (outline)", load: ri(hi2, "HiOutlineShare") },
  "hi2-outline-link": { label: "Link (outline)", load: ri(hi2, "HiOutlineLink") },
  "hi2-outline-check": { label: "Check (outline)", load: ri(hi2, "HiOutlineCheck") },
  "hi2-outline-chevron-left": { label: "Chevron Left", load: ri(hi2, "HiOutlineChevronLeft") },
  "hi2-outline-chevron-right": { label: "Chevron Right", load: ri(hi2, "HiOutlineChevronRight") },
  "hi2-outline-chevron-down": { label: "Chevron Down", load: ri(hi2, "HiOutlineChevronDown") },

  // Fleet – Tabler Icons (tb)
  "tb-gauge": { label: "Gauge", load: ri(tb, "TbGauge") },
  "tb-engine": { label: "Engine", load: ri(tb, "TbEngine") },
  "tb-battery-3": { label: "Battery", load: ri(tb, "TbBattery3") },
  "tb-thermometer": { label: "Thermometer", load: ri(tb, "TbThermometer") },
  "tb-satellite": { label: "Satellite", load: ri(tb, "TbSatellite") },
  "tb-route": { label: "Route", load: ri(tb, "TbRoute") },

  // Fleet – Ionicons (io5)
  "io5-speedometer": { label: "Speedometer", load: ri(io5, "IoSpeedometerOutline") },

  // Legacy aliases (backward compat with existing dashlet configs)
  "chart": { label: "Chart", load: ri(hi2, "HiChartBar") },
  "currency": { label: "Currency", load: ri(hi2, "HiCurrencyDollar") },
  "users": { label: "Users", load: ri(hi2, "HiUsers") },
  "cart": { label: "Cart", load: ri(hi2, "HiShoppingCart") },
  "clock": { label: "Clock", load: ri(hi2, "HiClock") },
  "check": { label: "Check", load: ri(hi2, "HiCheckCircle") },
  "info": { label: "Info", load: ri(hi2, "HiInformationCircle") },
  "warning": { label: "Warning", load: ri(hi2, "HiExclamationTriangle") },
  "cube": { label: "Cube", load: ri(hi2, "HiCube") },
  "truck": { label: "Truck", load: ri(hi2, "HiTruck") },
  "bolt": { label: "Bolt", load: ri(hi2, "HiBolt") },
};

/** All available icon keys */
export type IconKey = keyof typeof ICON_REGISTRY;

/** Sorted list of icon keys for rendering */
export const ICON_KEYS: IconKey[] = Object.keys(ICON_REGISTRY);
