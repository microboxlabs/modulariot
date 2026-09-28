import { askUserQuestionExtension } from "./ask-user-question";
import {
  showKnowledgeChangeExtension,
  showLearningEvalExtension,
  showLearningViewExtension,
} from "./learning-cards";
import { requestApprovalExtension } from "./request-approval";
import { showArtifactExtension } from "./show-artifact";
import { showDashboardDraftExtension } from "./show-dashboard-draft";
import { showDashletExtension } from "./show-dashlet";
import { showShareLinkExtension } from "./show-share-link";
import type { HarnessExtension } from "../harness-extension";

/**
 * Every structured-card extension, storytelling ones included. The dev
 * preview pages render straight from this list; a live `HarnessChat` goes
 * through `resolveDefaultHarnessExtensions` so flag-gated cards drop out.
 */
export const DEFAULT_HARNESS_EXTENSIONS: HarnessExtension[] = [
  askUserQuestionExtension,
  showDashletExtension,
  showArtifactExtension,
  showDashboardDraftExtension,
  requestApprovalExtension,
  showShareLinkExtension,
  showKnowledgeChangeExtension,
  showLearningEvalExtension,
  showLearningViewExtension,
];

/**
 * The default extension list for a live `HarnessChat`, minus any card whose
 * runtime flag isn't set. Keeps the toolkit — and therefore what's offered
 * to the configured harness — consistent with the feature flags.
 */
export function resolveDefaultHarnessExtensions(opts: {
  storytellingEnabled: boolean;
}): HarnessExtension[] {
  return DEFAULT_HARNESS_EXTENSIONS.filter(
    (extension) => opts.storytellingEnabled || !extension.requiresStorytelling
  );
}
