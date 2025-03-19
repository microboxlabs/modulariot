import fs from "fs";
import path from "path";

export function getCurrentVersion(): string {
  try {
    const releasesDir = path.join(process.cwd(), "src/features/releases");
    const files = fs.readdirSync(releasesDir);

    // Find the most recent version file (assuming format vX.Y.md)
    const versionFile = files
      .filter((file) => file.match(/^v\d+\.\d+\.md$/))
      .sort()
      .pop();

    if (versionFile) {
      // Extract version from filename (remove .md extension)
      return versionFile.replace(".md", "");
    }

    return "unknown";
  } catch (error) {
    console.error("Error getting version:", error);
    return "unknown";
  }
}
