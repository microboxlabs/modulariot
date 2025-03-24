import EndTreatment from "../end-treatment";
import CallDriver from "../menus/call-driver/call-driver";
import DriverResponse from "../menus/call-driver/driver-response";
import DeriveToSpecialist from "../menus/derive-to-specialist/derive-to-specialist";
import { FaPhoneAlt, FaCheck, FaArrowRight } from "react-icons/fa";
import IgnoreCondition from "./ignore-condition/ignore-condition";
import { TiDelete } from "react-icons/ti";
import { I18nRecord } from "@/features/i18n/i18n.service.types";
import { TreatmentsGeneralResponseItem } from "@/app/api/treatments/general/route.type";
import { requestTreatment } from "@/features/common/providers/client-api.provider";
import { TreatmentsRequest } from "@/app/api/treatments/route.type";
import { BiLogoMicrosoftTeams } from "react-icons/bi";

const sendTeamsCall = async (phoneNumber: string) => {
  // Get the phone number from the treatment request
  if (!phoneNumber) return;

  // Open Teams with the phone number parameter
  window.open(
    `https://teams.microsoft.com/l/call/0/0?users=4:${phoneNumber}`,
    "_blank",
  );
};

const sendTeamsNotification = async (phoneNumber: string) => {
  // Get the phone number from the treatment request
  if (!phoneNumber) return;

  // TODO:Open Teams to generate a notification about the new treatement
  /* window.open(
    `https://teams.microsoft.com/l/message/0/0?users=4:${phoneNumber}`,
    "_blank",
  ); */
};

export const getCallDriver = (
  dict: I18nRecord,
  treatmentData: TreatmentsGeneralResponseItem | null,
  messageToCommunicate: string,
  setMessageToCommunicate: (message: string) => void,
  driverResponse: string,
  setDriverResponse: (response: string) => void,
  treatmentRequest: TreatmentsRequest,
  setTreatmentRequest: (request: TreatmentsRequest) => void,
  isTeamsNotificationOn: boolean,
  setIsTeamsNotificationOn: (isTeamsNotificationOn: boolean) => void,
) => [
  {
    title: (dict.symptoms as I18nRecord).treatment,
    preactions: async () => {
      const response = await requestTreatment(treatmentRequest);
      setTreatmentRequest({
        ...treatmentRequest,
        treatment_id: response.treatment_id,
      });
    },
    elements: [
      {
        element_name: (dict.symptoms as I18nRecord).call_driver,
        description: (dict.symptoms as I18nRecord).call_driver_description,
        component: (
          <CallDriver
            dict={dict as I18nRecord}
            treatmentData={treatmentData}
            messageToCommunicate={messageToCommunicate}
            setMessageToCommunicate={setMessageToCommunicate}
          />
        ),
        icon: <FaPhoneAlt className="h-5 w-5" />,
        logo: null,
        buttons: [
          {
            color: "light",
            text: (dict.symptoms as I18nRecord).teams_call,
            text2: (dict.symptoms as I18nRecord).teams_call2,
            icon: <BiLogoMicrosoftTeams className="w-6 h-6 ml-2 mr-2" />,
            action: "none",
            function: async () => {
              await sendTeamsCall(
                treatmentData?.trip_info?.driver_contact ?? "",
              );
            },
          },
          {
            color: "blue",
            text: (dict.symptoms as I18nRecord).save_treatment,
            action: "next",
            function: async () => {
              const response = await requestTreatment(treatmentRequest);
              setTreatmentRequest({
                ...treatmentRequest,
                treatment_id: response.treatment_id,
              });
            },
          },
        ],
      },
      {
        element_name: (dict.symptoms as I18nRecord).driver_response,
        description: (dict.symptoms as I18nRecord).driver_response_description,
        component: (
          <DriverResponse
            dict={dict as I18nRecord}
            driverResponse={driverResponse}
            setDriverResponse={setDriverResponse}
          />
        ),
        icon: <FaPhoneAlt className="h-5 w-5" />,
        logo: null,
        button: {
          text: (dict.symptoms as I18nRecord).save_response,
          action: "next",
          function: async () => {
            await requestTreatment({
              ...treatmentRequest,
              driver_response: driverResponse,
            });
          },
        },
      },
      {
        element_name: (dict.symptoms as I18nRecord).end_treatment,
        description: (dict.symptoms as I18nRecord).end_treatment_description,
        component: (
          <EndTreatment
            dict={dict as I18nRecord}
            isTeamsNotificationOn={isTeamsNotificationOn}
            setIsTeamsNotificationOn={setIsTeamsNotificationOn}
          />
        ),
        icon: <FaCheck className="h-5 w-5" />,
        logo: null,
        button: {
          text: (dict.symptoms as I18nRecord).finish_treatment,
          action: "end",
          function: async () => {
            if (isTeamsNotificationOn) {
              await sendTeamsNotification(
                treatmentData?.trip_info?.driver_contact ?? "",
              );
            }
          },
        },
      },
    ],
  },
];

export const getDeriveToSpecialist = (
  dict: I18nRecord,
  isTeamsNotificationOn: boolean,
  setIsTeamsNotificationOn: (isTeamsNotificationOn: boolean) => void,
) => [
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
        component: (
          <EndTreatment
            dict={dict as I18nRecord}
            isTeamsNotificationOn={isTeamsNotificationOn}
            setIsTeamsNotificationOn={setIsTeamsNotificationOn}
          />
        ),
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

export const getIgnoreCondition = (
  dict: I18nRecord,
  isTeamsNotificationOn: boolean,
  setIsTeamsNotificationOn: (isTeamsNotificationOn: boolean) => void,
) => [
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
        component: (
          <EndTreatment
            dict={dict as I18nRecord}
            isTeamsNotificationOn={isTeamsNotificationOn}
            setIsTeamsNotificationOn={setIsTeamsNotificationOn}
          />
        ),
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
