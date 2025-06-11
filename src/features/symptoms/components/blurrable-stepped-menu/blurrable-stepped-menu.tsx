/*

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

const blurred = "opacity-100 visible z-10 backdrop-blur-[10px] bg-black/30";
const clean = "opacity-0 invisible backdrop-blur-[0px] bg-transparent";

export default function BlurrableSteppedMenu({
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

  const [driverResponse, setDriverResponse] = useState<string>("");

  const [duration, setDuration] = useState<number>(300);
  const [scope, setScope] = useState<string>("synthom");
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

  const [isTeamsNotificationOn, setIsTeamsNotificationOn] =
    useState<boolean>(false);

  const base_sections = [
    {
      title: (dict.symptoms as I18nRecord).symptoms as string,
      elements: [
        {
          element_name: `${(dict.symptoms as I18nRecord).symptom as string}: ${(
            (dict.symptoms as I18nRecord)[
              treatmentData?.symptom_info?.name?.toUpperCase() as string
            ] as string
          )?.trim()} - ${(
            (dict.symptoms as I18nRecord)[
              icuConditions[
                ("" +
                  treatmentData?.symptom_info
                    ?.icu_code) as unknown as keyof typeof icuConditions
              ]?.toLowerCase() as string
            ] as string
          )?.trim()}`,
          description: (dict.symptoms as I18nRecord)
            .symptom_information as string,
          component: (
            <SideInfoData
              dict={dict}
              treatmentData={treatmentData}
              loading={false}
              error={null}
              setSelectedTreatment={() => {}}
              setSelectedTreatmentIndex={() => {}}
              withBorder={true}
              withBottomPadding={false}
            />
          ),
          icon: null,
          logo: (
            <Image
              src={
                titles[
                  treatmentData?.symptom_info
                    ?.icu_code as unknown as keyof typeof titles
                ]?.icon ?? alarmImage
              }
              alt="Icon"
              width={100}
              height={100}
            />
          ),
          button: null,
        },
      ],
    },
  ];

  let side_sections: any[] = [];

  switch (selectedOption) {
    case "call_driver":
      side_sections = [
        ...base_sections,
        ...getCallDriver(
          dict,
          treatmentData,
          messageToCommunicate,
          setMessageToCommunicate,
          driverResponse,
          setDriverResponse,
          treatmentRequest,
          setTreatmentRequest,
          isTeamsNotificationOn,
          setIsTeamsNotificationOn,
        ),
      ];
      break;
    case "derive_to_specialist":
      side_sections = [
        ...base_sections,
        ...getDeriveToSpecialist(
          dict,
          isTeamsNotificationOn,
          setIsTeamsNotificationOn,
        ),
      ];
      break;
    case "ignore_condition":
      side_sections = [
        ...base_sections,
        ...getIgnoreCondition(
          dict,
          treatmentData,
          duration,
          setDuration,
          scope,
          setScope,
          treatmentRequest,
          setTreatmentRequest,
          isTeamsNotificationOn,
          setIsTeamsNotificationOn,
        ),
      ];
      break;
    default:
      side_sections = base_sections;
  }

  const [selected_section, setSelectedSection] = useState<number>(1);
  const [selected_elements, setSelectedElements] = useState<number[]>([0, 0]);
  const [max_selected_element, setMaxSelectedElement] = useState<number>(0);
  const [displayed_element, setDisplayedElement] = useState<React.ReactNode>(
    side_sections[selected_section].elements[
      selected_elements[selected_section]
    ].component,
  );

  const updateSelectedSection = (newSectionIndex: number) => {
    setSelectedSection(newSectionIndex);
    setSelectedElements((prev) => {
      const updated = [...prev];
      updated[newSectionIndex] = Math.min(
        updated[newSectionIndex],
        side_sections[newSectionIndex].elements.length - 1,
      );

      return updated;
    });
  };

  const updateSelectedElement = (newElementIndex: number) => {
    setSelectedElements((prev) => {
      const updated = [...prev];
      updated[selected_section] = newElementIndex;
      return updated;
    });
  };

  useEffect(() => {
    setDisplayedElement(
      side_sections[selected_section].elements[
        selected_elements[selected_section]
      ].component,
    );
  }, [selected_elements, selected_section]);

  useEffect(() => {
    if (isMenuOpen) {
      const preaction = side_sections[selected_section]?.preactions;
      preaction && preaction();
    }
    updateSelectedSection(1);
    updateSelectedElement(0);
  }, [isMenuOpen]);

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
        
        <div className="w-3/6 h-full !flex flex-col gap-2 p-2">
          {side_sections.map((section, section_index) => (
            <div
              key={section.title}
              className={`rounded-lg p-5 mb-1 transition-all duration-200 items-center gap-3 hover:bg-gray-100 dark:hover:bg-gray-700 hover:cursor-pointer
                ${
                  selected_section == section_index
                    ? "bg-gray-100 dark:bg-gray-700"
                    : "bg-white dark:bg-gray-800 opacity-30"
                }`}
              onClick={() => {
                updateSelectedSection(section_index);
              }}
            >
              <p className="text-sm mb-2 text-gray-900 dark:text-white">
                {section.title}
              </p>
              {section.elements.map((element: any, inner_index: number) => (
                <div
                  className={`rounded-lg p-2 transition-all duration-200 flex flex-row items-center gap-3
                    ${
                      inner_index <= max_selected_element
                        ? "hover:bg-gray-100 dark:hover:bg-gray-600"
                        : ""
                    }
                ${
                  selected_elements[selected_section] == inner_index &&
                  selected_section == section_index
                    ? "bg-gray-100 dark:bg-gray-700 text-blue-500"
                    : inner_index <= max_selected_element &&
                        selected_section == section_index
                      ? "text-gray-900 dark:text-white"
                      : "opacity-30 text-gray-900 dark:text-white"
                }`}
                  key={inner_index}
                  onClick={() => {
                    if (inner_index <= max_selected_element) {
                      updateSelectedElement(inner_index);
                    }
                  }}
                >
                  <div className="border-2 ml-1 font-light text-lg flex items-center justify-center border-gray-200 bg-white dark:bg-gray-800 dark:border-gray-700 rounded-lg w-10 h-10">
                    {element.logo ? element.logo : <p>{inner_index + 1}</p>}
                  </div>
                  <div className="flex flex-col">
                    <h1 className="text-sm font-medium">
                      {element.element_name}
                    </h1>
                    <p className="text-xs font-light text-gray-500 dark:text-gray-400">
                      {element.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
     
        <div className="w-5/6 p-2 flex flex-grow justify-center items-center overflow-y-hidden">
          <div className="w-full h-full overflow-y-auto flex flex-col items-center">
          
            <div className="w-full flex flex-col">
              <div className="flex flex-row items-center justify-between">
                <div className="w-full flex items-center gap-2 text-gray-500">
                  {side_sections[selected_section].elements[
                    selected_elements[selected_section]
                  ].icon ? (
                    <div className="w-10 h-10 flex items-center justify-center text-gray-500">
                      {
                        side_sections[selected_section].elements[
                          selected_elements[selected_section]
                        ].icon
                      }
                    </div>
                  ) : side_sections[selected_section].elements[
                      selected_elements[selected_section]
                    ].logo ? (
                    <div className="w-10 h-10 flex items-center justify-center">
                      {
                        side_sections[selected_section].elements[
                          selected_elements[selected_section]
                        ].logo
                      }
                    </div>
                  ) : null}
                  <h1 className="text-lg font-medium text-gray-900 dark:text-white">
                    {
                      side_sections[selected_section].elements[
                        selected_elements[selected_section]
                      ].element_name
                    }
                  </h1>
                </div>
                <div
                  onClick={() => {
                    setIsMenuOpen(false);
                    setMaxSelectedElement(0);
                  }}
                  className="flex flex-row text-gray-500 items-center gap-2 rounded-lg p-2 hover:bg-gray-100 dark:hover:bg-gray-700 transition-all duration-200"
                >
                  <IoClose className="h-7 w-7" />
                </div>
              </div>
              <div className="w-full flex flex-row  gap-2 mt-2 mb-5">
                {side_sections[selected_section].elements.map(
                  (element: any, inner_index: number) => {
                    return (
                      <div
                        className={`transition-all duration-200 w-8 h-2 ${selected_elements[selected_section] >= inner_index ? "bg-blue-500" : "bg-gray-200"} rounded-full`}
                        key={inner_index}
                      />
                    );
                  },
                )}
              </div>
            </div>
          
            <div className="flex flex-grow w-full flex-col gap-2 overflow-y-auto">
              {displayed_element}
              {side_sections[selected_section].elements[
                selected_elements[selected_section]
              ].button ? (
                <Button
                  className="w-full"
                  color="blue"
                  onClick={() => {
                    const new_selected_element =
                      selected_elements[selected_section] + 1;

                    const buttonAction =
                      side_sections[selected_section]?.elements[
                        selected_elements[selected_section]
                      ]?.button?.action;

                    const buttonActionFunction =
                      side_sections[selected_section]?.elements[
                        selected_elements[selected_section]
                      ]?.button?.function;

                    buttonActionFunction && buttonActionFunction();

                    if (buttonAction === "next") {
                      if (max_selected_element <= new_selected_element) {
                        setMaxSelectedElement(new_selected_element);
                      }
                      updateSelectedElement(new_selected_element);
                    } else if (buttonAction === "end") {
                      setIsMenuOpen(false);
                      router.push("/symptoms");
                    } else {
                      setIsMenuOpen(false);
                      setMaxSelectedElement(0);
                    }
                  }}
                >
                  {side_sections[selected_section]?.elements[
                    selected_elements[selected_section]
                  ]?.button?.text ?? ""}
                </Button>
              ) : side_sections[selected_section].elements[
                  selected_elements[selected_section]
                ].buttons ? (
                <div className="w-full flex flex-row gap-2">
                  {side_sections[selected_section].elements[
                    selected_elements[selected_section]
                  ].buttons.map((button: any, inner_index: number) => (
                    <Button
                      className="flex-1"
                      key={inner_index}
                      color={button.color}
                      onClick={() => {
                        const new_selected_element =
                          selected_elements[selected_section] + 1;

                        const buttonAction =
                          side_sections[selected_section]?.elements[
                            selected_elements[selected_section]
                          ]?.buttons[inner_index]?.action;

                        const buttonActionFunction =
                          side_sections[selected_section]?.elements[
                            selected_elements[selected_section]
                          ]?.buttons[inner_index]?.function;

                        buttonActionFunction && buttonActionFunction();

                        if (buttonAction === "next") {
                          if (max_selected_element <= new_selected_element) {
                            setMaxSelectedElement(new_selected_element);
                          }
                          updateSelectedElement(new_selected_element);
                        } else if (buttonAction === "end") {
                          setIsMenuOpen(false);
                          router.push("/symptoms");
                        } else if (buttonAction === "none") {
                          //Ignore
                        } else {
                          setIsMenuOpen(false);
                          setMaxSelectedElement(0);
                        }
                      }}
                    >
                      {side_sections[selected_section]?.elements[
                        selected_elements[selected_section]
                      ]?.buttons[inner_index]?.text ?? ""}

                      {side_sections[selected_section]?.elements[
                        selected_elements[selected_section]
                      ]?.buttons[inner_index]?.icon ?? null}

                      {side_sections[selected_section]?.elements[
                        selected_elements[selected_section]
                      ]?.buttons[inner_index]?.text2 ?? ""}
                    </Button>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
*/
