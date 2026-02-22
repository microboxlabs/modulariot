import type { Command } from "commander";
import { registerListCommand } from "./list.js";
import { registerGetCommand } from "./get.js";
import {
  registerCreateCommand,
  registerUpdateCommand,
  registerDeactivateCommand,
  registerPurgeCommand,
} from "./create.js";
import { registerSlotsCommand } from "./slots.js";
import { registerBookingsCommand } from "./bookings.js";
import { registerGroupsCommand } from "./groups.js";
import { registerTimeWindowsCommand } from "./time-windows.js";
import { registerSlotManagersCommand } from "./slot-managers.js";

export function registerCalendarCommand(program: Command): void {
  const calendar = program
    .command("calendar")
    .description("Manage calendars");

  registerListCommand(calendar);
  registerGetCommand(calendar);
  registerCreateCommand(calendar);
  registerUpdateCommand(calendar);
  registerDeactivateCommand(calendar);
  registerPurgeCommand(calendar);
  registerSlotsCommand(calendar);
  registerBookingsCommand(calendar);
  registerGroupsCommand(calendar);
  registerTimeWindowsCommand(calendar);
  registerSlotManagersCommand(calendar);
}
