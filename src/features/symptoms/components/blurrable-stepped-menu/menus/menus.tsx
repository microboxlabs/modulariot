import EndTreatment from "../end-treatment";
import CallDriver from "../menus/call-driver/call-driver";
import DriverResponse from "../menus/call-driver/driver-response";
import DeriveToSpecialist from "../menus/derive-to-specialist/derive-to-specialist";
import { FaPhoneAlt, FaCheck, FaArrowRight } from "react-icons/fa";
import IgnoreCondition from "./ignore-condition/ignore-condition";
import { TiDelete } from "react-icons/ti";
import { I18nRecord } from "@/features/i18n/i18n.service.types";

export const getCallDriver = (dict: I18nRecord) => [
  {
    title: (dict.symptoms as I18nRecord).treatment,
    elements: [
      {
        element_name: (dict.symptoms as I18nRecord).call_driver,
        description: (dict.symptoms as I18nRecord).call_driver_description,
        component: <CallDriver dict={dict as I18nRecord} />,
        icon: <FaPhoneAlt className="h-5 w-5" />,
        logo: null,
        button: {
          text: (dict.symptoms as I18nRecord).save_treatment,
          action: "next",
        },
      },
      {
        element_name: (dict.symptoms as I18nRecord).driver_response,
        description: (dict.symptoms as I18nRecord).driver_response_description,
        component: <DriverResponse dict={dict as I18nRecord} />,
        icon: <FaPhoneAlt className="h-5 w-5" />,
        logo: null,
        button: {
          text: (dict.symptoms as I18nRecord).save_response,
          action: "next",
        },
      },
      {
        element_name: (dict.symptoms as I18nRecord).end_treatment,
        description: (dict.symptoms as I18nRecord).end_treatment_description,
        component: <EndTreatment dict={dict as I18nRecord} />,
        icon: <FaCheck className="h-5 w-5" />,
        logo: null,
        button: {
          text: (dict.symptoms as I18nRecord).finish_treatment,
          action: "end",
        },
      },
    ],
  },
];

export const getDeriveToSpecialist = (dict: I18nRecord) => [
  {
    title: (dict.symptoms as I18nRecord).treatment,
    elements: [
      {
        element_name: (dict.symptoms as I18nRecord)
          .derive_to_specialist as string,
        description: (dict.symptoms as I18nRecord)
          .derive_to_specialist_description as string,
        component: <DeriveToSpecialist dict={dict as I18nRecord} />,
        icon: <FaArrowRight className="h-5 w-5" />,
        logo: null,
        button: {
          text: (dict.symptoms as I18nRecord).save_treatment,
          action: "next",
        },
      },
      {
        element_name: (dict.symptoms as I18nRecord).end_treatment,
        description: (dict.symptoms as I18nRecord)
          .end_treatment_description as string,
        component: <EndTreatment dict={dict as I18nRecord} />,
        icon: <FaCheck className="h-5 w-5" />,
        logo: null,
        button: {
          text: (dict.symptoms as I18nRecord).finish_treatment,
          action: "end",
        },
      },
    ],
  },
];

export const getIgnoreCondition = (dict: I18nRecord) => [
  {
    title: (dict.symptoms as I18nRecord).treatment,
    elements: [
      {
        element_name: (dict.symptoms as I18nRecord).ignore_condition,
        description: (dict.symptoms as I18nRecord).ignore_condition_description,
        component: <IgnoreCondition dict={dict as I18nRecord} />,
        icon: <TiDelete className="h-8 w-8" />,
        logo: null,
        button: {
          text: (dict.symptoms as I18nRecord).save_and_confirm,
          action: "next",
        },
      },
      {
        element_name: (dict.symptoms as I18nRecord).end_treatment,
        description: (dict.symptoms as I18nRecord).end_treatment_description,
        component: <EndTreatment dict={dict as I18nRecord} />,
        icon: <FaCheck className="h-5 w-5" />,
        logo: null,
        button: {
          text: (dict.symptoms as I18nRecord).finish_treatment,
          action: "end",
        },
      },
    ],
  },
];
