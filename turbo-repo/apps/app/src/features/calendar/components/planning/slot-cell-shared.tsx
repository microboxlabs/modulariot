// Back-compat shim — the slot-cell pieces (SlotCellContent, TimeLabelCell, …)
// now live in @microboxlabs/miot-calendar-ui. Kept so existing
// `./slot-cell-shared` imports (DayGrid, PlanningWeekView) keep resolving.
export * from "@microboxlabs/miot-calendar-ui";
