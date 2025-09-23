"use client";

import { TextInput } from "flowbite-react";
import { usePathname, useRouter } from "next/navigation";
import { useState, useRef, useEffect } from "react";
import { HiSearch } from "react-icons/hi";
import { useDebouncedCallback } from "use-debounce";
import Tags from "./tags";
import DateRangePicker from "@/features/common/components/date-picker/date-range-picker";
import DatePicker from "@/features/common/components/date-picker/date-picker";

export default function ParametrizedSearchBar({
  messages,
  searchParams,
  navegation_params,
}: {
  messages: any;
  searchParams: any;
  navegation_params: any;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const router = useRouter();
  const pathName = usePathname();
  const containerRef = useRef<HTMLDivElement>(null);

  const handleSearch = useDebouncedCallback((term: string, param: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (term) {
      params.set(param, term);
    } else {
      params.delete(param);
    }
    router.push(`${pathName}?${params.toString()}`);
  }, 300);

  // Handle clicks outside the component to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    };

    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [open]);

  return (
    <div ref={containerRef} className="flex items-center gap-2 flex-row">
      <div
        className={`flex items-center gap-2 flex-col relative ${open ? "bg-gray-100 dark:bg-gray-700 rounded-t-lg" : ""}`}
      >
        <TextInput
          className="w-full lg:w-96"
          icon={HiSearch}
          id="search"
          placeholder={messages.search}
          defaultValue={searchParams.get("search") || ""}
          onChange={(e) => {
            setSearch(e.target.value);
            // handleSearch(e);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              if (/^[^:]+:[^:]+$/.test(search)) {
                // Search for this page in validation format
                // Check if the search.split(":")[0] is equal to the label, change the value to the param
                const param = navegation_params.find(
                  (param: any) =>
                    param.label.toUpperCase() ===
                    search.split(":")[0].toUpperCase()
                );
                if (param) {
                  handleSearch(search.split(":")[1], param.param.key);
                } else {
                  handleSearch(search.split(":")[1], search.split(":")[0]);
                }
              }
            }
          }}
          autoComplete="off"
        />
        {open && (
          <div
            className={`absolute top-full w-full flex flex-col overflow-y-auto text-gray-700 dark:text-gray-300 border-x border-b border-gray-200 dark:border-gray-600 ${open ? "bg-gray-100 dark:bg-gray-700 rounded-b-lg" : ""}`}
          >
            {/^[^:]+:[^:]+$/.test(search) ? (
              <div
                className=" cursor-pointer transition-all duration-300 flex items-center py-2 px-4 text-sm font-light gap-1 whitespace-nowrap hover:bg-gray-200 dark:hover:bg-gray-600"
                onClick={() => {
                  if (/^[^:]+:[^:]+$/.test(search)) {
                    // Search for this page in validation format
                    // Check if the search.split(":")[0] is equal to the label, change the value to the param
                    const param = navegation_params.find(
                      (param: any) =>
                        param.label.toUpperCase() ===
                        search.split(":")[0].toUpperCase()
                    );
                    if (param) {
                      handleSearch(search.split(":")[1], param.param.key);
                    } else {
                      handleSearch(search.split(":")[1], search.split(":")[0]);
                    }
                  }
                }}
              >
                Buscar
                <label className="font-normal max-w-32 truncate dark:text-white text-black cursor-pointer">
                  {search.split(":")[1]}
                </label>
                como
                <label className="font-normal dark:text-white text-black cursor-pointer">
                  {search.split(":")[0]}
                </label>
              </div>
            ) : (
              (() => {
                return navegation_params
                  .filter((param: any) => param.param.type === "text")
                  .map((param: any, index: number) => (
                    <div
                      key={index}
                      className=" cursor-pointer transition-all duration-300 flex items-center py-2 px-4 text-sm font-light gap-1 whitespace-nowrap hover:bg-gray-200 dark:hover:bg-gray-600"
                      onClick={() => {
                        handleSearch(search, param.param.key);
                      }}
                    >
                      Buscar
                      <label className="font-normal max-w-32 truncate dark:text-white text-black cursor-pointer">
                        {search}
                      </label>
                      como
                      <label className="font-normal dark:text-white text-black cursor-pointer">
                        {param.label}
                      </label>
                    </div>
                  ));
              })()
            )}
            {navegation_params.filter(
              (param: any) => param.param.type === "date_range"
            ).length > 0 && (
              <>
                <hr className="border-gray-200 dark:border-gray-700" />
                <div className="text-xs italic px-2 pb-2 pt-1 text-gray-500 dark:text-gray-400 w-full flex flex-col gap-1">
                  {(() => {
                    const dateParams = navegation_params.filter(
                      (param: any) => param.param.type === "date_range"
                    );

                    return dateParams.map((param: any, index: number) => (
                      <DateRangePicker
                        key={index}
                        label={param.label}
                        onDateChange={(startDate: string, endDate: string) => {
                          const paramName = param.param.key || "date_range";

                          const params = new URLSearchParams(
                            searchParams.toString()
                          );

                          if (startDate) {
                            params.set(paramName + "_from", startDate);
                          } else {
                            params.delete(paramName + "_from");
                          }

                          if (endDate) {
                            params.set(paramName + "_to", endDate);
                          } else {
                            params.delete(paramName + "_to");
                          }

                          router.push(`${pathName}?${params.toString()}`);
                        }}
                      />
                    ));
                  })()}
                </div>
              </>
            )}
            <div className="text-xs italic p-2 text-gray-500 dark:text-gray-400 w-full flex flex-col gap-1">
              Desde <DatePicker />
              Hasta <DatePicker />
            </div>
          </div>
        )}
      </div>
      {/*<DateSelections />*/}
      <Tags
        searchParams={searchParams}
        router={router}
        pathName={pathName}
        navegation_params={navegation_params}
      />
    </div>
  );
}
