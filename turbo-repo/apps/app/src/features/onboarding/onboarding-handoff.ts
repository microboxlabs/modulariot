// Shared between the onboarding flow (sets this right before navigating to
// /home) and the arrival overlay on /home (reads + clears it on mount) so
// the "dissolve to reveal the page" effect only plays right after
// onboarding finishes, never on a normal visit to /home.
export const ONBOARDING_HANDOFF_KEY = "modulariot:from-onboarding";
