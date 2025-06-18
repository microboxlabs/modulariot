import React from "react";

export default function FormIcon({ selected_menu }: { selected_menu: any }) {
  return (
    <div className="w-full flex items-center gap-2 text-gray-500">
      {selected_menu.icon ? (
        <div className="w-10 h-10 flex items-center justify-center text-gray-500">
          {selected_menu.icon}
        </div>
      ) : selected_menu.logo ? (
        <div className="w-10 h-10 flex items-center justify-center">
          {selected_menu.logo}
        </div>
      ) : null}
      <h1 className="text-lg font-medium text-gray-900 dark:text-white">
        {selected_menu.title}
      </h1>
    </div>
  );
}
