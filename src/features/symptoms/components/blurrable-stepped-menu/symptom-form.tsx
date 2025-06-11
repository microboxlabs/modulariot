import Image from "next/image";
import React, { useEffect, useState } from "react";
import SideInfoData from "../map-view/side-info-data";
import { IoClose } from "react-icons/io5";
import { Button } from "flowbite-react";
import {
  getCallDriver,
  getDeriveToSpecialist,
  getIgnoreCondition,
} from "./menus/menus";
import { I18nRecord } from "@/features/i18n/i18n.service.types";
import { TreatmentsGeneralResponseItem } from "@/app/api/treatments/general/route.type";
import { TreatmentsRequest } from "@/app/api/treatments/route.type";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import icuConditions from "@/features/symptoms/model/icu_condition.json";
import { titles } from "../../types/symptom-titles";
import { SympthomTemplateResponse } from "@/features/common/providers/alfresco-api/alfresco-api.types";
import alarmImage from "@assets/images/alarm.gif";
import FormIcon from "./form-icon";
import CallDriver from "./menus/call-driver/call-driver";
import { FaPhoneAlt } from "react-icons/fa";
import DriverResponse from "./menus/call-driver/driver-response";

const blurred = "opacity-100 visible z-10 backdrop-blur-[10px] bg-black/30";
const clean = "opacity-0 invisible backdrop-blur-[0px] bg-transparent";

export default function SymptomForm({
  setIsMenuOpen,
  isMenuOpen,
  className,
  dict,
  selectedOption,
  treatmentData,
  treatments_templates,
}: {
  setIsMenuOpen: (isMenuOpen: boolean) => void;
  isMenuOpen: boolean;
  className: string;
  dict: I18nRecord;
  selectedOption: string;
  treatmentData: TreatmentsGeneralResponseItem | null;
  treatments_templates: SympthomTemplateResponse | null;
}) {
  const router = useRouter();
  const { data: session } = useSession();
  const userEmail = session?.user?.email ?? "";

  const [messageToCommunicate, setMessageToCommunicate] = useState<string>(
    treatments_templates?.data?.message ?? "",
  );

  const [selected_menu, setSelectedMenu] = useState<string>("call_driver");
  const [driverResponse, setDriverResponse] = useState<string>("");

  const menus = {
    call_driver: {
      title: "Call Driver",
      component: (
        <div className="w-full h-full flex flex-row items-center justify-center">
          <CallDriver
            dict={dict as I18nRecord}
            treatmentData={treatmentData}
            messageToCommunicate={messageToCommunicate}
            setMessageToCommunicate={setMessageToCommunicate}
            driverResponse={driverResponse}
            setDriverResponse={setDriverResponse}
          />
        </div>
      ),
      icon: <FaPhoneAlt className="h-5 w-5" />,
    },
  };

  const [treatmentRequest, setTreatmentRequest] = useState<TreatmentsRequest>({
    asset_id: treatmentData?.trip_info?.asset_id ?? "",
    assigned_to: userEmail,
    client_id: null,
    status: "active",
    symptom_id: treatmentData?.symptom_info?.id.toString() ?? "",
    treatment_type: "",
    trip_id: treatmentData?.trip_info?.trip_id ?? "",
    message: messageToCommunicate ?? "",
    driver_response: driverResponse ?? "",
    description: undefined,
    treatment_id: undefined,
  });

  useEffect(() => {
    setTreatmentRequest({
      ...treatmentRequest,
      message: messageToCommunicate,
    });
  }, [messageToCommunicate]);

  return (
    <div
      className={`fixed inset-0 flex justify-center items-center z-[60] transition-all duration-300 ${isMenuOpen ? blurred : clean}`}
      onClick={(e) => {
        e.stopPropagation();
      }}
    >
      <div
        className={`w-[1000px] h-[500px] bg-white dark:bg-gray-800 rounded-lg p-4 gap-2 !flex flex-row ${className}`}
      >
        <div className="w-5/6 p-2 flex flex-grow justify-center items-center overflow-y-hidden">
          <div className="w-full h-full overflow-y-auto flex flex-col items-center">
            {/*Header*/}
            <div className="w-full flex flex-col">
              <div className="flex flex-row items-center justify-between">
                <FormIcon
                  selected_menu={menus[selected_menu as keyof typeof menus]}
                />
                <div
                  onClick={() => {
                    setIsMenuOpen(false);
                  }}
                  className="flex flex-row text-gray-500 items-center gap-2 rounded-lg p-2 hover:bg-gray-100 dark:hover:bg-gray-700 transition-all duration-200"
                >
                  <IoClose className="h-7 w-7" />
                </div>
              </div>
            </div>
            {/*Header*/}
            {/*page data*/}
            <div className="flex flex-grow w-full flex-col gap-2 overflow-y-auto">
              {menus[selected_menu as keyof typeof menus].component}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
