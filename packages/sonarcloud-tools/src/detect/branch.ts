import { execSync } from "node:child_process";

const SAFE_ENV = {
  ...process.env,
  PATH: "/usr/local/bin:/usr/bin:/bin",
};

export function detectBranch(): string {
  try {
    return execSync("git branch --show-current", {
      encoding: "utf-8",
      env: SAFE_ENV,
    }).trim();
  } catch {
    // fallback for detached HEAD
  }
  try {
    return execSync("git rev-parse --abbrev-ref HEAD", {
      encoding: "utf-8",
      env: SAFE_ENV,
    }).trim();
  } catch {
    throw new Error(
      "Could not detect git branch (not a repo or detached HEAD)",
    );
  }
}
