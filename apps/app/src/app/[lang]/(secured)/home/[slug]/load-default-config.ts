import fs from "fs";
import path from "path";
import type { DashboardStorageSchema } from "@/features/dashboard/types/dashboard.types";

/**
 * Loads a default dashboard config from
 *   src/features/dashboard/defaults/{slug}-config.json
 *
 * Returns null if the file doesn't exist or is invalid — in that case the
 * dashboard starts empty as usual.
 *
 * Place a JSON file matching the DashboardStorageSchema (version 2) in the
 * defaults directory to pre-populate a specific path on first load.
 */
export function loadDefaultConfig(
  slug: string
): DashboardStorageSchema | null {
  // Guard against path traversal — only allow safe slug characters
  if (!/^[a-zA-Z0-9_-]+$/.test(slug)) return null;

  const filePath = path.join(
    process.cwd(),
    "src",
    "features",
    "dashboard",
    "defaults",
    `${slug}-config.json`
  );

  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    const parsed = JSON.parse(raw) as DashboardStorageSchema;

    // Basic schema validation — must be version 2
    if (parsed.version !== 2 || !Array.isArray(parsed.widgets)) return null;

    return parsed;
  } catch {
    // File not found or invalid JSON → silent fallback
    return null;
  }
}
