import { execSync } from "node:child_process";

export function detectBranch(): string {
  try {
    return execSync("git branch --show-current", { encoding: "utf-8" }).trim();
  } catch {
    // fallback for detached HEAD
  }
  try {
    return execSync("git rev-parse --abbrev-ref HEAD", {
      encoding: "utf-8",
    }).trim();
  } catch {
    throw new Error(
      "Could not detect git branch (not a repo or detached HEAD)",
    );
  }
}
