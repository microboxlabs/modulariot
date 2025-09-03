import FilterComponent from "../filter-component";
import FilterOption from "../filter-option";
import { useState } from "react";
import { type ActiveFilters } from "../types/active-filters.type";
import { type Option } from "../types/options.type";


export default function mapFilter(
  {
    main_filter,
    setMainFilter,
    onChange,
    filter_id,
    label,
    icon,
  }: {
    main_filter: Record<string, Option[]>
    setMainFilter: (filters: Record<string, Option[]>) => void
    onChange: () => void
    filter_id: string
    label: string
    icon: React.ReactElement
  }
) {
  const [filters, set_filters] = useState<Option[]>(main_filter[filter_id] || []);
  const onChangeFilter = (updatedOptions: Option[]) => {
    set_filters(updatedOptions);
    main_filter[filter_id] = updatedOptions;
    setMainFilter({ ...main_filter });
    onChange();
  };

  return <FilterComponent
    label={label}
    onChange={onChange}
    setFilters={set_filters}
    filters={filters}
    icon={icon}
  >
    {
    filters.map((option, index) =>
      <FilterOption
        key={option.code}
        text={option.text}
        filter_value={option.filter_value}
        code={option.code}
        icon={option.icon}
        activated={option.activated}
        onClick={() => {
            const newFilters = [...filters];
            if (newFilters[index]) {
              newFilters[index].activated = !newFilters[index].activated;
            }
            set_filters(newFilters);
            onChangeFilter(newFilters);
          }
        }
      />)
    }
  </FilterComponent>
}