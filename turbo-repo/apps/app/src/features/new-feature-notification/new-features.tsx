import { I18nRecord } from "../i18n/i18n.service.types";
import KanbanSlider from "./slider-components/kanban-slider";

export enum typeDescriptor {
  Slidable, // It has multiple "Slides" of information
  Dismissable, // It just has a button of "Dismiss" and the user can manualle mark it so it does not appear again
  Selectable, // It has the posibility to "Accept" or "Decline" the new feature and it will appear only once unless the user declines the feature
}

/**
 * # Get Feature Descriptors
 *
 * This function returns an object containing descriptors for new features to be displayed in a notification modal.
 * Each feature descriptor includes an ID, title, description, and an image/gif.
 *
 * ## Parameters
 * - `dict`: An I18nRecord object used for internationalization of text strings.
 *
 * ## Returns
 * An object where each key is a feature identifier and the value is an object containing:
 * - `id`: A string representing the feature version.
 * - `title`: A string representing the feature title.
 * - `description`: A JSX element containing the feature description.
 * - `image`: An imported image/gif to be displayed in the notification.
 * ## Note
 * Aparently the format of the gif is important for his correct rendering, use this tool: https://ezgif.com for creating them
 *
 */

//
function getFeatureDescriptors({ dict }: { dict: I18nRecord }) {
  return {
    "": KanbanSlider(dict),
  };
}

export { getFeatureDescriptors };
