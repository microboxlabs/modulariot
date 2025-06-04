import fs from "fs";
import path from "path";

function compareVersions(a: string, b: string): number {
  const versionA = a.replace("v", "").split(".").map(Number);
  const versionB = b.replace("v", "").split(".").map(Number);

  for (let i = 0; i < Math.max(versionA.length, versionB.length); i++) {
    const numA = versionA[i] || 0;
    const numB = versionB[i] || 0;

    if (numA !== numB) {
      return numA - numB;
    }
  }
  return 0;
}

export function getCurrentVersion(): string {
  try {
    const releasesDir = path.join(process.cwd(), "src/features/releases");
    const files = fs.readdirSync(releasesDir);

    // Find the most recent version file (assuming format vX.Y.md)
    const versionFile = files
      .filter((file) => file.match(/^v\d+\.\d+\.md$/))
      .sort((a, b) => compareVersions(a, b))
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
