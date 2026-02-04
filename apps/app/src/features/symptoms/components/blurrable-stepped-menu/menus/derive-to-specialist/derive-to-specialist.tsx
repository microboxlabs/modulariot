"use client";

import { Dropdown, DropdownItem, Textarea } from "flowbite-react";
import { useState } from "react";
import { FaChevronDown } from "react-icons/fa";
import { HiCheck } from "react-icons/hi";

const specialists = [
  {
    name: "CAT",
    title: "Centro de atención y trafico",
  },
  {
    name: "Jefe ETIS",
    title: "Equipo de transporte y seguridad",
  },
  {
    name: "Jefe Nacional de Transporte",
    title: "Logística",
  },
];

export default function DeriveToSpecialist({ dict }: { dict: any }) {
  const [selectedSpecialist, setSelectedSpecialist] = useState<string | null>(
    null
  );

  return (
    <div className="h-full w-full flex flex-col items-center justify-center gap-2">
      <div className=" w-full flex flex-col items-center  gap-5 flex-grow">
        <div className="w-full flex flex-col gap-2">
          <h1 className="w-full text-left text-sm font-light justify-self-end text-gray-900 dark:text-white flex flex-row items-center gap-2">
            <HiCheck />
            {dict.symptoms.select_entity}
          </h1>
          <div className="w-full">
            <Dropdown
              label={dict.symptoms.specialist}
              renderTrigger={() => (
                <div className="w-full flex flex-row items-center justify-between px-3 bg-gray-100 dark:bg-gray-700 rounded-md p-2 hover:cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-600 transition-all duration-200">
                  {selectedSpecialist ? (
                    <p className="text-sm text-gray-500 dark:text-gray-400 flex flex-row items-center gap-2">
                      <div className="w-8 h-8 bg-gray-200 dark:bg-gray-800 rounded-full"></div>
                      {selectedSpecialist}
                    </p>
                  ) : (
                    <p className="text-sm flex items-center text-gray-500 dark:text-gray-400 h-8">
                      {dict.symptoms.specialist}
                    </p>
                  )}
                  <FaChevronDown className="text-gray-500 dark:text-gray-400" />
                </div>
              )}
            >
              {specialists.map((specialist) => (
                <DropdownItem
                  key={specialist.name}
                  onClick={() => setSelectedSpecialist(specialist.name)}
                >
                  <div className="w-full flex flex-row items-center gap-2">
                    <div className="w-10 h-10 bg-gray-200 dark:bg-gray-800 rounded-full"></div>
                    <div className="flex flex-col items-start">
                      <p className="text-sm text-gray-900 dark:text-white">
                        {specialist.name}
                      </p>
                      <p className="text-sm font-light text-gray-500 dark:text-gray-400">
                        {specialist.title}
                      </p>
                    </div>
                  </div>
                </DropdownItem>
              ))}
            </Dropdown>
          </div>
        </div>
        <div className="w-full flex flex-col gap-2">
          <h1 className="w-full text-left text-sm font-light justify-self-end text-gray-900 dark:text-white">
            {dict.symptoms.message_to_communicate}
          </h1>
          <Textarea
            placeholder={dict.symptoms.message_to_specialist}
            className="w-full h-32"
          />
        </div>
      </div>
    </div>
  );
}
