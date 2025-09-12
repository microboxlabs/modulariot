import { FaBook /* FaClock, FaPlusCircle, FaMapPin  */ } from "react-icons/fa";
//import Tag from "../tag";
//import { ListOptions } from "./list-options";

export default function TaskListTitle() {
  return (
    <div className="flex flex-row justify-between items-center p-2 bg-gray-200 dark:bg-gray-800 rounded-lg text-gray-900 dark:text-white">
      {/* Title */}
      <div className="flex flex-row items-center gap-2">
        <div className="text-gray-900 dark:text-white flex items-center justify-center transition-all duration-200  rounded-md w-10 h-10 p-2 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800">
          <FaBook className="h-4 w-4" />
        </div>
        {/* Tareas Turno Día */}
      </div>

      {/* Filters */}
      {/* <div className="text-gray-600 dark:text-gray-400 flex flex-row items-center gap-2">
        Filtros
        <Tag>
          <FaClock />
          Últimos 30 min
        </Tag>
        <Tag>
          <FaMapPin />
          ANF
        </Tag>
        <Tag>
          <FaPlusCircle />
          Urgentes
        </Tag>
      </div> */}

      {/* Options */}
      {/* <ListOptions /> */}
    </div>
  );
}
