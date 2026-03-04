export interface FilterItemConfig {
  /** Column key whose distinct values are used as filter pills */
  column: string;
  /** Label shown before the filter pills, e.g. "Estado:" */
  label: string;
}

export interface FilterConfig {
  enabled: boolean;
  items: FilterItemConfig[];
}
