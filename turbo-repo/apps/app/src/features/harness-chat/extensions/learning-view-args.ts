/** A learning session's `/layers` or `/diff`, shown as a card that opens the
 * editable knowledge, or this session's changes, in the working area. */
export const SHOW_LEARNING_VIEW_TOOL = "show_learning_view";

export type LearningView = "layers" | "diff";

export type ShowLearningViewArgs = { view: LearningView };
