import { askUserQuestionExtension } from "./ask-user-question";
import { showDashletExtension } from "./show-dashlet";
import type { HarnessExtension } from "../harness-extension";

/**
 * Extensions mounted by default when `HarnessChat` isn't given its own
 * `extensions` prop. Add new structured-card types (and future ones the
 * harness gets trained to send) here, or pass a different list in per call
 * site to override entirely.
 */
export const DEFAULT_HARNESS_EXTENSIONS: HarnessExtension[] = [
  askUserQuestionExtension,
  showDashletExtension,
];
