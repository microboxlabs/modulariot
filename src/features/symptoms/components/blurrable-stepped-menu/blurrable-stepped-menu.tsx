import noAlarmImage from "@assets/images/no_alarm.gif";
import Image from "next/image";
import React, { useEffect, useState } from "react";
import SideInfoData from "../side-info-data";
import { IoClose } from "react-icons/io5";
import { Button } from "flowbite-react";
import { getCallDriver, getDeriveToSpecialist } from "./menus/menus";
import { I18nRecord } from "@/features/i18n/i18n.service.types";

const blurred = "opacity-100 visible z-10 backdrop-blur-[10px] bg-black/30";
const clean = "opacity-0 invisible backdrop-blur-[0px] bg-transparent";

export default function BlurrableSteppedMenu({
  setIsMenuOpen,
  isMenuOpen,
  className,
  dict,
  lang,
  selectedOption,
}: {
  setIsMenuOpen: (isMenuOpen: boolean) => void;
  isMenuOpen: boolean;
  className: string;
  dict: I18nRecord;
  lang: string;
  selectedOption: string;
}) {
  const base_sections = [
    {
      title: (dict.symptoms as I18nRecord).symptoms as string,
      elements: [
        {
          element_name: `${(dict.symptoms as I18nRecord).code_black as string}: ${(dict.symptoms as I18nRecord).continuous_driving_state as string}`,
          description: (dict.symptoms as I18nRecord)
            .symptom_information as string,
          component: (
            <SideInfoData
              dict={dict}
              lang={lang}
              treatmentData={null}
              loading={false}
              error={null}
            />
          ),
          icon: null,
          logo: (
            <Image src={noAlarmImage} alt="Icon" width={100} height={100} />
          ),
          button: null,
        },
      ],
    },
  ];

  let side_sections: any[] = [];

  switch (selectedOption) {
    case "call_driver":
      side_sections = [...base_sections, ...getCallDriver(dict)];
      break;
    case "derive_to_specialist":
      side_sections = [...base_sections, ...getDeriveToSpecialist(dict)];
      break;
    default:
      side_sections = base_sections;
  }

  const [selected_section, setSelectedSection] = useState<number>(1);
  const [selected_elements, setSelectedElements] = useState<number[]>([0, 0]);
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
    updateSelectedSection(1);
    updateSelectedElement(0);
  }, [isMenuOpen]);

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
        {/*Left data*/}
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
              {section.elements.map((element, inner_index) => (
                <div
                  className={`rounded-lg p-2 transition-all duration-200 flex flex-row items-center gap-3 ${
                    selected_elements[selected_section] == inner_index &&
                    selected_section == section_index
                      ? "bg-gray-100 dark:bg-gray-700 text-blue-500"
                      : selected_elements[selected_section] > inner_index &&
                          selected_section == section_index
                        ? "text-gray-900 dark:text-white"
                        : "opacity-30 text-gray-900 dark:text-white"
                  }`}
                  key={inner_index}
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
        {/*Right data*/}
        <div className="w-5/6 p-2 flex flex-grow justify-center items-center overflow-y-hidden">
          <div className="w-full h-full overflow-y-auto flex flex-col items-center">
            {/*stepper*/}
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
                  }}
                  className="flex flex-row text-gray-500 items-center gap-2 rounded-lg p-2 hover:bg-gray-100 dark:hover:bg-gray-700 transition-all duration-200"
                >
                  <IoClose className="h-7 w-7" />
                </div>
              </div>
              <div className="w-full flex flex-row  gap-2 mt-2 mb-5">
                {side_sections[selected_section].elements.map(
                  (element, inner_index) => {
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
            {/*page data*/}
            <div className="flex flex-grow w-full flex-col gap-2 overflow-y-auto">
              {displayed_element}
              {side_sections[selected_section].elements[
                selected_elements[selected_section]
              ].button ? (
                <Button
                  className="w-full"
                  color="blue"
                  onClick={() => {
                    const buttonAction =
                      side_sections[selected_section]?.elements[
                        selected_elements[selected_section]
                      ]?.button?.action;
                    if (buttonAction === "next") {
                      updateSelectedElement(
                        selected_elements[selected_section] + 1,
                      );
                    } else {
                      setIsMenuOpen(false);
                    }
                  }}
                >
                  {side_sections[selected_section]?.elements[
                    selected_elements[selected_section]
                  ]?.button?.text ?? ""}
                </Button>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
