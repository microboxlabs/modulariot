"use client";

import { SlOptionsVertical } from "react-icons/sl";
import { FaPlus, FaPencilAlt, FaRegTrashAlt } from "react-icons/fa";
import CustomDropdown from "../../../custom-dropdown/custom-dropdown";

const options = [
  {
    id: 1,
    label: "Crear",
    icon: <FaPlus />,
    function: () => console.log("Opción 1 seleccionada"),
    disabledOption: true,
  },
  {
    id: 1,
    label: "Editar",
    icon: <FaPencilAlt />,
    function: () => console.log("Opción 1 seleccionada"),
    disabledOption: true,
  },
  {
    id: 1,
    label: "Eliminar",
    icon: <FaRegTrashAlt />,
    function: () => console.log("Opción 1 seleccionada"),
    disabledOption: true,
  },
];

export function ListOptions() {
  return (
    <CustomDropdown
      options={options}
      renderTrigger={
        <div className="text-sm text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 p-2 rounded-full transition-all duration-300 cursor-pointer">
          <SlOptionsVertical />
        </div>
      }
    />
  );
}
