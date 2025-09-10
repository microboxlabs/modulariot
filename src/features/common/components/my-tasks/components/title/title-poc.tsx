"use client";

import { FaBook, FaClock, FaPlusCircle, FaMapPin } from "react-icons/fa";
import Tag from "../tag";
import { ListOptions } from "./list-options";
import IconSelector from "./icon-selector";
import { useState } from "react";

export type Status = "new" | "edit" | null;

export default function TaskListTitle() {
  const [state, setState] = useState<Status>("new");

  return (
    <div className="flex flex-row justify-between items-center p-2 bg-gray-200 dark:bg-gray-800 rounded-lg text-gray-900 dark:text-white">
      {/* Title */}
      <div className="flex flex-row items-center gap-2">
        <IconSelector state={state} />
        Tareas Turno Día
      </div>

      {/* Filters */}
      <div className="text-gray-600 dark:text-gray-400 flex flex-row items-center gap-2">
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
      </div>

      {/* Options */}
      <ListOptions />
    </div>
  );
}
