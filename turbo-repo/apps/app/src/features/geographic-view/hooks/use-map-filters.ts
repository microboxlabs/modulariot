import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { useCallback } from "react";
import { Option } from "../components/filter-component";

type FilterType = "trip" | "conditions" | "speed";

export function useMapFilters() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const getInitialActivated = (
    filterType: FilterType,
    code: string,
    defaultActivated: boolean
  ): boolean => {
    const param = searchParams.get(filterType);
    if (param === null) return defaultActivated;
    const codes = param.split(",");
    return codes.includes(code);
  };

  const syncFiltersToUrl = useCallback(
    (filters: {
      conditions: Option[];
      speed: Option[];
      tripStates: Option[];
    }) => {
      const params = new URLSearchParams(searchParams.toString());

      const setFilterParam = (
        key: FilterType,
        options: Option[],
        defaultCodes: string[]
      ) => {
        const activeCodes = options
          .filter((o) => o.activated)
          .map((o) => o.code);

        const isDefault =
          activeCodes.length === defaultCodes.length &&
          defaultCodes.every((c) => activeCodes.includes(c));

        if (activeCodes.length === 0 || isDefault) {
          params.delete(key);
        } else {
          params.set(key, activeCodes.join(","));
        }
      };

      setFilterParam("trip", filters.tripStates, ["1"]);
      setFilterParam("conditions", filters.conditions, []);
      setFilterParam("speed", filters.speed, []);

      const query = params.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, {
        scroll: false,
      });
    },
    [searchParams, router, pathname]
  );

  return { getInitialActivated, syncFiltersToUrl };
}
