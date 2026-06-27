import { TextInput } from "flowbite-react";
import { HiSearch } from "react-icons/hi";
import { useDebouncedCallback } from "use-debounce";
import { usePathname, useRouter } from "next/navigation";
import { getNavegationParams } from "./navegation_params";
import { I18nRecord } from "@/features/i18n/i18n.service.types";
import React, { useEffect } from "react";
import { KbdHint } from "./kbd-hint";
import ParametrizedSearchBar from "./parametrized-searchbar";

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

  // ⌘K / Ctrl+K focuses the search field from anywhere; Esc blurs it.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        const el = document.getElementById("search") as HTMLInputElement | null;
        el?.focus();
        el?.select();
      } else if (e.key === "Escape") {
        const el = document.getElementById("search") as HTMLInputElement | null;
        if (el && document.activeElement === el) {
          el.blur();
        }
      }
    };
    globalThis.addEventListener("keydown", onKeyDown);
    return () => globalThis.removeEventListener("keydown", onKeyDown);
  }, []);

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

  const segments = pathName.split("/").filter(Boolean);
  const final_path = segments.at(-1);
  const parent_path = segments.at(-2);
  const navegation_params = getNavegationParams(dict, searchParams.size);

  // If the parent segment maps to null in navegation_params, inherit no-searchbar behavior
  if (parent_path && parent_path in navegation_params && !navegation_params[parent_path as keyof typeof navegation_params]) {
    return null;
  }

  if (!final_path || !(final_path in navegation_params)) {
    return (
      <div className="flex items-center gap-2">
        <TextInput
          className="w-full lg:w-96"
          icon={HiSearch}
          rightIcon={KbdHint}
          id="search"
          name="search"
          placeholder={messages.search}
          type="search"
          defaultValue={searchParams.get("search") || ""}
          onChange={handleSearch}
        />
      </div>
    );
  }

  if (!navegation_params[final_path as keyof typeof navegation_params]) {
    return null;
  }

  return (
    <ParametrizedSearchBar
      messages={messages}
      searchParams={searchParams}
      dict={dict}
      navegation_params={navegation_params[final_path as keyof typeof navegation_params]}
    />
  );
}
