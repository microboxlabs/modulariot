import { Dropdown, Textarea } from "flowbite-react";
import { FaChevronDown } from "react-icons/fa";
import { HiCheck } from "react-icons/hi";
export default function DeriveToSpecialist({ dict }: { dict: any }) {
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
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {dict.symptoms.specialist}
                  </p>
                  <FaChevronDown className="text-gray-500 dark:text-gray-400" />
                </div>
              )}
            >
              <Dropdown.Item>
                <div className="w-full flex flex-row items-center gap-2">
                  <div className="w-10 h-10 bg-gray-200 dark:bg-gray-700 rounded-md"></div>
                  <p className="text-sm text-gray-900 dark:text-white">
                    Juan Perez
                  </p>
                </div>
              </Dropdown.Item>
              <Dropdown.Item>
                <div className="w-full flex flex-row items-center gap-2">
                  <div className="w-10 h-10 bg-gray-200 dark:bg-gray-700 rounded-md"></div>
                  <p className="text-sm text-gray-900 dark:text-white">
                    Juan Perez
                  </p>
                </div>
              </Dropdown.Item>
              <Dropdown.Item>
                <div className="w-full flex flex-row items-center gap-2">
                  <div className="w-10 h-10 bg-gray-200 dark:bg-gray-700 rounded-md"></div>
                  <p className="text-sm text-gray-900 dark:text-white">
                    Juan Perez
                  </p>
                </div>
              </Dropdown.Item>
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
