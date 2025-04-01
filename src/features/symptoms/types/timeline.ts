export interface TimelineElement {
  date: string;
  assigned_to: string;
  items: TimelineItem[];
}

export interface TimelineItem {
  start: string;
  end: string;
  icu_condition: string;
  description: string;
  type: string;
  assigned_to: string;
  icu_code: string | null;
}
