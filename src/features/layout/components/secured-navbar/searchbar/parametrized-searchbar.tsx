"use client";

import { TextInput } from "flowbite-react";
import { usePathname, useRouter } from "next/navigation";
import { useState, useRef, useEffect } from "react";
import { HiSearch } from "react-icons/hi";
import { useDebouncedCallback } from "use-debounce";
import Tags from "./tags";
// import DateRangePicker from "@/features/common/components/date-picker/date-range-picker";
import { ParamType } from "./navegation_params";
import CustomSelector from "@/features/common/components/custom-dropdown/custom-selector";
import { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import { logger } from "@/lib/logger";
import DateRangePicker from "@/features/common/components/date-picker/date-range-picker";

interface ParametrizedSearchBarProps {
  readonly dict: I18nRecord;
  readonly messages: any;
  readonly searchParams: any;
  readonly navegation_params: any;
  readonly className?: string;
}

export default function ParametrizedSearchBar({
  dict,
  messages,
  searchParams,
  navegation_params,
  className = "",
}: ParametrizedSearchBarProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [localStorageOptions, setLocalStorageOptions] = useState<string[]>([]);
  const router = useRouter();
  const pathName = usePathname();
  const containerRef = useRef<HTMLDivElement>(null);

  // Listen for localStorage changes
  useEffect(() => {
    const updateOptionsFromLocalStorage = () => {
      try {
        const storedOptions = localStorage.getItem("selector");
        if (storedOptions) {
          const parsed = JSON.parse(storedOptions);
          setLocalStorageOptions(Array.isArray(parsed) ? parsed : []);
        }
      } catch (error) {
        console.error("Error parsing localStorage selector:", error);
        setLocalStorageOptions([]);
      }
    };

    // Initial load
    updateOptionsFromLocalStorage();

    // Listen for storage changes from other tabs/windows
    globalThis.addEventListener("storage", updateOptionsFromLocalStorage);

    // Listen for custom event when localStorage is updated in the same tab
    globalThis.addEventListener(
      "localStorageUpdated",
      updateOptionsFromLocalStorage
    );

    return () => {
      globalThis.removeEventListener("storage", updateOptionsFromLocalStorage);
      globalThis.removeEventListener(
        "localStorageUpdated",
        updateOptionsFromLocalStorage
      );
    };
  }, []);

  const handleSearch = useDebouncedCallback((term: string, param: string) => {
    // Check if this param is unique
    const paramConfig = navegation_params.find(
      (p: any) => p.param.key === param
    );
    const isUnique = paramConfig?.unique || false;

    let params: URLSearchParams;

    if (isUnique && term) {
      // For unique params, create new URLSearchParams with only the new parameter
      params = new URLSearchParams();
      params.set(param, term);
    } else {
      // Normal behavior for non-unique params
      params = new URLSearchParams(searchParams.toString());
      if (term) {
        params.set(param, term);
      } else {
        params.delete(param);
      }
    }

    router.push(`${pathName}?${params.toString()}`);
  }, 300);

  // Handle clicks outside the component to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      // Check if click is inside the main container
      const isInsideContainer = containerRef.current?.contains(
        event.target as Node
      );

      // Check if click is inside any dropdown portal (CustomSelector dropdowns)
      const isInsideDropdownPortal = (event.target as Element)?.closest(
        "[data-dropdown-portal]"
      );

      if (!isInsideContainer && !isInsideDropdownPortal) {
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

  const date_range_params = navegation_params.filter(
    (param: any) => param.param.type === "date_range"
  );
  const bool_params = navegation_params.filter(
    (param: any) => param.param.type === "bool"
  );
  const selector_params = navegation_params.filter(
    (param: any) => param.param.type === "selector"
  );

  const style =
    className != ""
      ? className
      : `flex items-center gap-2 flex-row w-full ${open ? "lg:relative absolute left-0 right-0 top-0 p-3 lg:p-0 bg-white dark:bg-gray-800 z-30" : ""} `;

  return (
    <div ref={containerRef} className={`${style} `}>
      <div
        className={`flex items-center gap-2 flex-col relative w-full lg:w-fit ${open ? "bg-gray-100 dark:bg-gray-700 rounded-t-lg" : ""}`}
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
            <BoolParams
              bool_elements={bool_params}
              dict={dict}
              searchParams={searchParams}
              pathName={pathName}
              router={router}
            />
            <DateParams
              date_elements={date_range_params}
              searchParams={searchParams}
              pathName={pathName}
              router={router}
            />
            <SelectorParams
              selector_elements={selector_params}
              dict={dict}
              searchParams={searchParams}
              pathName={pathName}
              router={router}
              dynamicOptions={localStorageOptions}
            />
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

function SelectorParams({
  searchParams,
  selector_elements,
  dict,
  pathName,
  router,
  dynamicOptions,
}: {
  searchParams: URLSearchParams;
  selector_elements: any[];
  dict: I18nRecord;
  pathName: string;
  router: any;
  dynamicOptions: string[];
}) {
  if (selector_elements.length === 0) {
    return null;
  }

  return (
    <>
      <hr className="border-gray-200 dark:border-gray-700" />
      {selector_elements.map((param: any, index: number) => {
        // Use dynamic options from localStorage for specific params, or fallback to param.options
        let options: { value: string; label: string }[] = [];

        if (dynamicOptions.length > 0) {
          // For symptom_name in symptoms page, use dynamic options from localStorage
          options = [
            { value: "", label: "-" },
            ...dynamicOptions.map((option) => ({
              value: option,
              label: option,
            })),
          ];
        } else if (param.options && Array.isArray(param.options)) {
          // For other selectors (like originType), use their predefined options
          options = param.options;
        } else {
          // Fallback to empty options
          options = [{ value: "", label: "-" }];
        }

        return (
          <div
            key={index}
            className=" cursor-pointer transition-all duration-300 flex items-center py-2 px-4 text-sm font-light gap-1 whitespace-nowrap"
          >
            {param.label}
            <CustomSelector
              options={options}
              base_value={searchParams.get(param.param.key || "selector") || ""}
              onChange={(value) => {
                const paramName = param.param.key || "selector";

                const params = new URLSearchParams(searchParams.toString());

                if (value) {
                  params.set(paramName, value);
                } else {
                  params.delete(paramName);
                }

                router.push(`${pathName}?${params.toString()}`);
              }}
            />
          </div>
        );
      })}
    </>
  );
}

function DateParams({
  date_elements,
  searchParams,
  pathName,
  router,
}: {
  date_elements: ParamType[];
  searchParams: URLSearchParams;
  pathName: string;
  router: any;
}) {
  logger.info(date_elements);
  logger.info(searchParams);
  logger.info(pathName);
  logger.info(router);
  if (date_elements.length > 0) {
    return (
      <>
        <hr className="border-gray-200 dark:border-gray-700" />
        {(() => {
          return date_elements.map((param: any, index: number) => (
            <DateRangePicker
              key={index}
              label={param.label}
              onDateChange={(startDate: string, endDate: string) => {
                const paramName = param.param.key || "date_range";

                const params = new URLSearchParams(searchParams.toString());

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
      </>
    );
  }
}

function BoolParams({
  searchParams,
  bool_elements,
  dict,
  pathName,
  router,
}: {
  searchParams: URLSearchParams;
  bool_elements: ParamType[];
  dict: I18nRecord;
  pathName: string;
  router: any;
}) {
  if (bool_elements.length > 0) {
    return (
      <>
        <hr className="border-gray-200 dark:border-gray-700" />
        {bool_elements.map((param: any, index: number) => (
          <div
            key={index}
            className=" cursor-pointer transition-all duration-300 flex items-center py-2 px-4 text-sm font-light gap-1 whitespace-nowrap"
          >
            {param.label}
            <CustomSelector
              options={getCategories(dict)}
              base_value={searchParams.get(param.param.key || "bool") || ""}
              onChange={(value) => {
                const paramName = param.param.key || "date_range";

                const params = new URLSearchParams(searchParams.toString());

                if (value) {
                  params.set(paramName, value);
                } else {
                  params.delete(paramName);
                }

                router.push(`${pathName}?${params.toString()}`);
              }}
            />
          </div>
        ))}
      </>
    );
  }
}

export function getCategories(dict: I18nRecord) {
  return [
    {
      value: "",
      label: "-",
    },
    {
      value: "INTERNAL",
      label: tr("searchbar.internal", dict),
    },
    {
      value: "EXTERNAL",
      label: tr("searchbar.external", dict),
    },
  ];
}
