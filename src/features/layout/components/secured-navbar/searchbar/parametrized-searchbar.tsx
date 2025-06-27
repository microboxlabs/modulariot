"use client";

import { Datepicker, TextInput } from "flowbite-react";
import { usePathname, useRouter } from "next/navigation";
import { useState, useRef, useEffect } from "react";
import { HiSearch } from "react-icons/hi";
import { useDebouncedCallback } from "use-debounce";
import Tags from "./tags";
import DateSelections from "./date-selections";


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
                handleSearch(search.split(":")[1], search.split(":")[0]);
              }
            }
          }}
          autoComplete="off"
        />
        {open && search.length > 0 && (
          <div
            className={`absolute top-full w-full flex flex-col overflow-y-auto text-gray-700 dark:text-gray-300 border-x border-b border-gray-200 dark:border-gray-600 ${open ? "bg-gray-100 dark:bg-gray-700 rounded-b-lg" : ""}`}
          >
            {/^[^:]+:[^:]+$/.test(search) ? (
              <div
                className=" cursor-pointer transition-all duration-300 flex items-center py-2 px-4 text-sm font-light gap-1 whitespace-nowrap hover:bg-gray-200 dark:hover:bg-gray-600"
                onClick={() => {
                  handleSearch(search.split(":")[1], search.split(":")[0]);
                }}
              >
                Buscar
                <label className="font-normal max-w-32 truncate text-white cursor-pointer">
                  {search.split(":")[1]}
                </label>
                como
                <label className="font-normal text-white cursor-pointer">
                  {search.split(":")[0]}
                </label>
              </div>
            ) : (
              navegation_params.map((param: any, index: number) => (
                <div
                  key={index}
                  className=" cursor-pointer transition-all duration-300 flex items-center py-2 px-4 text-sm font-light gap-1 whitespace-nowrap hover:bg-gray-200 dark:hover:bg-gray-600"
                  onClick={() => {
                    handleSearch(search, param.param);
                  }}
                >
                  Buscar
                  <label className="font-normal max-w-32 truncate text-white cursor-pointer">
                    {search}
                  </label>
                  como
                  <label className="font-normal text-white cursor-pointer">
                    {param.label}
                  </label>
                </div>
              ))
            )}
          </div>
        )}
      </div>
      <DateSelections />
      <Tags searchParams={searchParams} router={router} pathName={pathName} />
    </div>
  );
}
