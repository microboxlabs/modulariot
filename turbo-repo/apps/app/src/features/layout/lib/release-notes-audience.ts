import "server-only";

export function getReleaseNotesAudience(): "platform" | "coordinator" {
  return process.env.RELEASE_NOTES_AUDIENCE === "platform"
    ? "platform"
    : "coordinator";
}
