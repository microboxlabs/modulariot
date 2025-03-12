import EndTreatment from "../end-treatment";
import CallDriver from "../menus/call-driver/call-driver";
import DriverResponse from "../menus/call-driver/driver-response";
import DeriveToSpecialist from "../menus/derive-to-specialist/derive-to-specialist";
import { FaPhoneAlt, FaCheck, FaArrowRight } from "react-icons/fa";
import IgnoreCondition from "./ignore-condition/ignore-condition";
import { TiDelete } from "react-icons/ti";

export const getCallDriver = (dict: any) => [
  {
    title: dict.symptoms.treatment,
    elements: [
      {
        element_name: dict.symptoms.call_driver,
        description: dict.symptoms.call_driver_description,
        component: <CallDriver dict={dict} />,
        icon: <FaPhoneAlt className="h-5 w-5" />,
        logo: null,
        button: {
          text: dict.symptoms.save_treatment,
          action: "next",
        },
      },
      {
        element_name: dict.symptoms.driver_response,
        description: dict.symptoms.driver_response_description,
        component: <DriverResponse dict={dict} />,
        icon: <FaPhoneAlt className="h-5 w-5" />,
        logo: null,
        button: {
          text: dict.symptoms.save_response,
          action: "next",
        },
      },
      {
        element_name: dict.symptoms.end_treatment,
        description: dict.symptoms.end_treatment_description,
        component: <EndTreatment dict={dict} />,
        icon: <FaCheck className="h-5 w-5" />,
        logo: null,
        button: {
          text: dict.symptoms.finish_treatment,
          action: "end",
        },
      },
    ],
  },
];

export const getDeriveToSpecialist = (dict: any) => [
  {
    title: dict.symptoms.treatment,
    elements: [
      {
        element_name: dict.symptoms.derive_to_specialist,
        description: dict.symptoms.derive_to_specialist_description,
        component: <DeriveToSpecialist dict={dict} />,
        icon: <FaArrowRight className="h-5 w-5" />,
        logo: null,
        button: {
          text: dict.symptoms.save_treatment,
          action: "next",
        },
      },
      {
        element_name: dict.symptoms.end_treatment,
        description: dict.symptoms.end_treatment_description,
        component: <EndTreatment dict={dict} />,
        icon: <FaCheck className="h-5 w-5" />,
        logo: null,
        button: {
          text: dict.symptoms.finish_treatment,
          action: "end",
        },
      },
    ],
  },
];

export const getIgnoreCondition = (dict: any) => [
  {
    title: dict.symptoms.treatment,
    elements: [
      {
        element_name: dict.symptoms.ignore_condition,
        description: dict.symptoms.ignore_condition_description,
        component: <IgnoreCondition dict={dict} />,
        icon: <TiDelete className="h-8 w-8" />,
        logo: null,
        button: {
          text: dict.symptoms.save_and_confirm,
          action: "next",
        },
      },
      {
        element_name: dict.symptoms.end_treatment,
        description: dict.symptoms.end_treatment_description,
        component: <EndTreatment dict={dict} />,
        icon: <FaCheck className="h-5 w-5" />,
        logo: null,
        button: {
          text: dict.symptoms.finish_treatment,
          action: "end",
        },
      },
    ],
  },
];
