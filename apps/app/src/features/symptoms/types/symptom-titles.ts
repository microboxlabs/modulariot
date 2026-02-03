import alarmImage from "@assets/images/alarm.gif";
import maskImage from "@assets/images/mask.gif";
import patchImage from "@assets/images/patch.gif";
import hospitalImage from "@assets/images/hospital.svg";

export const titles = {
  "0": {
    base: "restablished_symptoms",
    title: "stable",
    icon: patchImage,
  },
  "1": {
    base: "restablished_symptoms",
    title: "in_observation",
    icon: maskImage,
  },
  "2": {
    base: "restablished_symptoms",
    title: "compromised_condition",
    icon: hospitalImage,
  },
  "3": {
    base: "urgent_symptoms",
    title: "critical_condition",
    icon: hospitalImage,
  },
  "4": {
    base: "urgent_symptoms",
    title: "code_black",
    icon: alarmImage,
  },
  "6": {
    base: "symptoms_being_treated",
    title: "in_treatment",
    icon: maskImage,
  },
  "8": {
    base: "symptoms_being_treated",
    title: "in_remission",
    icon: patchImage,
  },
};
