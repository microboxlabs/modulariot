/**
 * PROTOTYPE — the calling channels offered in the dialing step, shared with
 * whoever needs to show "which one was used" afterward (the final form's
 * "A quién se llamó" card). None of these but "phone" are real integrations.
 */

import { FaPhoneAlt, FaWhatsapp } from "react-icons/fa";
import { SiGooglemeet } from "react-icons/si";
import { BiLogoMicrosoftTeams } from "react-icons/bi";

export type CallMethod = "phone" | "whatsapp" | "meet" | "teams";

export const ALL_CALL_METHODS: CallMethod[] = ["phone", "whatsapp", "meet", "teams"];

export const CALL_METHOD_ICONS: Record<CallMethod, typeof FaPhoneAlt> = {
  phone: FaPhoneAlt,
  whatsapp: FaWhatsapp,
  meet: SiGooglemeet,
  teams: BiLogoMicrosoftTeams,
};

/** i18n key (under `symptoms.`) for each method's label. */
export const CALL_METHOD_LABEL_KEYS: Record<CallMethod, string> = {
  phone: "call_center_method_phone",
  whatsapp: "call_center_method_whatsapp",
  meet: "call_center_method_meet",
  teams: "call_center_method_teams",
};
