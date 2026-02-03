import { TextInput } from "flowbite-react";
import { HiSearch } from "react-icons/hi";
import ParametrizedSearchBar from "./parametrized-searchbar";
import { useDebouncedCallback } from "use-debounce";
import { usePathname, useRouter } from "next/navigation";
import { getNavegationParams } from "./navegation_params";
import { I18nRecord } from "@/features/i18n/i18n.service.types";
import React from "react";

export default function SearchBar({
  messages,
  searchParams,
  dict,
}: {
  messages: any;
  searchParams: any;
  dict: I18nRecord;
}) {
  const router = useRouter();
  const pathName = usePathname();

  const handleSearch = useDebouncedCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const term = event.target.value;
      const params = new URLSearchParams(searchParams.toString());

      if (term) {
        params.set("search", term);
      } else {
        params.delete("search");
      }
      router.push(`${pathName}?${params.toString()}`);
    },
    300
  );

  const final_path = pathName.split("/")[pathName.split("/").length - 1];
  const navegation_params = getNavegationParams(dict, searchParams.size);

  if (!(final_path in navegation_params)) {
    return (
      <div className="flex items-center gap-2">
        <TextInput
          className="w-full lg:w-96"
          icon={HiSearch}
          id="search"
          name="search"
          placeholder={messages.search}
          type="search"
          defaultValue={searchParams.get("search") || ""}
          onChange={handleSearch}
        />
        {/* @TODO: Add filter button */}
        {/* <Button color="gray">
        <Filter className="h-4 w-4" />
      </Button> */}
      </div>
    );
  }

  if (!navegation_params[final_path as keyof typeof navegation_params]) {
    return null;
  }

  return (
    <ParametrizedSearchBar
      dict={dict}
      messages={messages}
      searchParams={searchParams}
      navegation_params={
        navegation_params[final_path as keyof typeof navegation_params]
      }
    />
  );
}
