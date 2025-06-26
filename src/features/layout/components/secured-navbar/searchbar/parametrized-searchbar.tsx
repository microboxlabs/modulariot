"use client";

import { TextInput } from "flowbite-react";
import { usePathname, useRouter } from "next/navigation";
import { useState, useRef, useEffect } from "react";
import { HiSearch } from "react-icons/hi";
import { useDebouncedCallback } from "use-debounce";

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
    <div
      ref={containerRef}
      className={`flex items-center gap-2 flex-col relative ${open ? "bg-gray-100 dark:bg-gray-700 rounded-t-lg" : ""}`}
    >
      <TextInput
        className="w-full lg:w-96"
        theme={{
          field: {
            input: {
              base: "block w-full border focus:outline-none focus:ring-1 disabled:cursor-not-allowed disabled:opacity-50",
              sizes: {
                sm: "p-2 sm:text-xs",
                md: "p-2.5 text-sm",
                lg: "p-4 sm:text-base",
              },
              colors: {
                gray: `border-gray-300 bg-gray-50 text-gray-900 placeholder-gray-500 focus:border-primary-500 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400 dark:focus:border-primary-500 dark:focus:ring-primary-500 ${
                  /^[^:]+:[^:]+$/.test(search)
                    ? "text-blue-600 dark:text-blue-400"
                    : ""
                }`,
                info: "border-cyan-500 bg-cyan-50 text-cyan-900 placeholder-cyan-700 focus:border-cyan-500 focus:ring-cyan-500 dark:border-cyan-400 dark:bg-cyan-100 dark:focus:border-cyan-500 dark:focus:ring-cyan-500",
                failure:
                  "border-red-500 bg-red-50 text-red-900 placeholder-red-700 focus:border-red-500 focus:ring-red-500 dark:border-red-400 dark:bg-red-100 dark:focus:border-red-500 dark:focus:ring-red-500",
                warning:
                  "border-yellow-500 bg-yellow-50 text-yellow-900 placeholder-yellow-700 focus:border-yellow-500 focus:ring-yellow-500 dark:border-yellow-400 dark:bg-yellow-100 dark:focus:border-yellow-500 dark:focus:ring-yellow-500",
                success:
                  "border-green-500 bg-green-50 text-green-900 placeholder-green-700 focus:border-green-500 focus:ring-green-500 dark:border-green-400 dark:bg-green-100 dark:focus:border-green-500 dark:focus:ring-green-500",
              },
            },
          },
        }}
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
          }
        }}
        autoComplete="off"
      />
      {open && search.length > 0 && (
        <div
          className={`absolute top-full w-full flex flex-col overflow-y-auto text-gray-700 dark:text-gray-300 border-x border-b border-gray-200 dark:border-gray-600 ${open ? "bg-gray-100 dark:bg-gray-700 rounded-b-lg" : ""}`}
        >
          {navegation_params.map((param: any, index: number) => (
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
          ))}
        </div>
      )}
    </div>
  );
}
