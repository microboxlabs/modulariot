import { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { useEffect, useState } from "react";
import { FaTag } from "react-icons/fa";
import { IoIosClose } from "react-icons/io";

export default function Tags({
  searchParams,
  router,
  pathName,
}: {
  searchParams: URLSearchParams;
  router: AppRouterInstance;
  pathName: string;
}) {
  const [filterOpen, setFilterOpen] = useState(false);
  const [filter, setFilter] = useState<
    {
      name: string;
      value: string;
    }[]
  >([]);

  // here from the searched params generate a list of tags
  useEffect(() => {
    if (searchParams) {
      const params = new URLSearchParams(searchParams.toString());
      const tags = Array.from(params.entries()).map(([key, value]) => ({
        name: key,
        value,
      }));
      setFilter(tags);
    }
  }, [searchParams]);

  return (
    <div className={`${filter.length > 0 ? "scale-100" : "scale-0"} `}>
      <div
        className="h-10 w-10 select-none cursor-pointer relative flex items-center justify-center p-2 bg-gray-100 dark:bg-gray-700 rounded-lg border border-transparent transition-all duration-300 hover:border-gray-300 dark:hover:border-gray-600"
        onClick={() => setFilterOpen(!filterOpen)}
      >
        <FaTag className="text-gray-500 dark:text-gray-400" />
      </div>
      {filterOpen && (
        <div className="absolute top-full left-0 bg-white dark:bg-gray-700 rounded-lg p-2 mt-2 flex flex-col gap-2 border border-gray-300 dark:border-gray-600">
          {filter.map((tag, index) => (
            <div
              key={index}
              className="w-fit border border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-gray-600 rounded-lg py-1 px-2 text-sm font-light whitespace-nowrap flex gap-1 text-gray-500 dark:text-gray-300"
              onClick={() => {
                const params = new URLSearchParams(searchParams.toString());
                params.delete(tag.name);
                router.push(`${pathName}?${params.toString()}`);
              }}
            >
              <IoIosClose
                className=" bg-gray-200 dark:bg-gray-500 rounded-full cursor-pointer text-gray-500 dark:text-gray-300 hover:bg-gray-300 hover:text-gray-700 dark:hover:bg-gray-300 dark:hover:text-gray-700 transition-all duration-300"
                size={20}
              />
              <label className="font-normal">{tag.name}:</label> {tag.value}
            </div>
          ))}
        </div>
      )}
      <div className="absolute bg-amber-500 rounded-full w-5 h-5 flex items-center justify-center text-sm font-light whitespace-nowrap text-gray-500 dark:text-gray-300 top-[-0.625rem] right-[-0.625rem]">
        {filter.length}
      </div>
    </div>
  );
}
