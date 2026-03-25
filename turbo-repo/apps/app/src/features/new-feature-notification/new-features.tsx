import { I18nRecord } from "../i18n/i18n.service.types";
import { tr } from "../i18n/tr.service";
import signal_historic_gif from "@assets/images/new_features/signal-historic.gif";
import symptom_historic_gif from "@assets/images/table-new-functionality.gif";
import Slider from "./slider-components/slider";

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
    "": Slider(dict),
    "signal-history": {
      id: "0.0",
      title: tr("new_functionality.signal_historic.title", dict),
      image: signal_historic_gif,
      description: (isActive: boolean) => [
        <div key="signal-history-content" className="flex flex-col gap-2">
          <p className="text-md">
            {tr(
              "new_functionality.signal_historic.we_added_a_new_functionality_for",
              dict
            )}{" "}
            <b>
              {tr(
                "new_functionality.signal_historic.search_historic_pulses",
                dict
              )}
            </b>
          </p>
          <p className="text-md">
            {tr("new_functionality.signal_historic.second_paragraph", dict)}{" "}
            <b>
              {tr(
                "new_functionality.signal_historic.license_plate_and_date_range",
                dict
              )}
            </b>
          </p>
          <p
            className={`text-md font-bold text-blue-500 dark:text-blue-400 ${isActive ? "animate-bounce" : ""}`}
          >
            {tr("new_functionality.try_it_now", dict)}
          </p>
        </div>,
      ],
      type: typeDescriptor.Dismissable, // This can be either "Dismissable" or "Selectable" for future implementations
    },
    symptoms: {
      id: "0.0",
      title: tr("new_functionality.symptom_historic.title", dict),
      image: symptom_historic_gif,
      description: (isActive: boolean) => [
        <div key="symptoms-content" className="flex flex-col gap-2">
          <p className="text-md">
            {tr(
              "new_functionality.symptom_historic.we_added_a_new_functionality_for",
              dict
            )}{" "}
            <b>
              {tr(
                "new_functionality.symptom_historic.filter_by_condition",
                dict
              )}
            </b>
          </p>
          <p className="text-md">
            {tr("new_functionality.symptom_historic.second_paragraph", dict)}
          </p>
          <p className="text-md">
            {tr("new_functionality.symptom_historic.for_now", dict)}{" "}
            <b>{tr("new_functionality.symptom_historic.its_optional", dict)}</b>
            {tr("new_functionality.symptom_historic.but", dict)}{" "}
            <b>
              {tr("new_functionality.symptom_historic.in_the_future", dict)}
            </b>
          </p>
          <p
            className={`text-md font-bold text-blue-500 dark:text-blue-400 ${isActive ? "animate-bounce" : ""}`}
          >
            {tr("new_functionality.try_it_now", dict)}
          </p>
        </div>,
      ],
      type: typeDescriptor.Selectable, // This can be either "Dismissable" or "Selectable" for future implementations
    },
  };
}

export { getFeatureDescriptors };
