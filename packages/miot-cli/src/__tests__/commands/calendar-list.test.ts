import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Command } from "commander";
import { registerCalendarCommand } from "../../commands/calendar/index.js";

vi.mock("../../action-context.js", () => ({
  getActionContext: vi.fn(),
}));

import { getActionContext } from "../../action-context.js";

const mockGetActionContext = vi.mocked(getActionContext);

function createProgram(): Command {
  const program = new Command();
  program
    .name("miot")
    .option("--base-url <url>")
    .option("--token <token>")
    .option("--profile <name>")
    .option("--output <mode>");
  registerCalendarCommand(program);
  program.exitOverride();
  return program;
}

describe("calendar list", () => {
  beforeEach(() => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should call calendars.list and print JSON", async () => {
    const mockCalendars = [
      { id: "1", code: "test", name: "Test", timezone: "UTC", active: true },
    ];
    const mockClient = {
      calendars: { list: vi.fn().mockResolvedValue(mockCalendars) },
    };
    mockGetActionContext.mockReturnValue({
      client: mockClient as any,
      outputMode: "json",
    });

    const program = createProgram();
    await program.parseAsync(["node", "miot", "calendar", "list"]);

    expect(mockClient.calendars.list).toHaveBeenCalledWith({
      active: undefined,
      groupCode: undefined,
    });
    expect(console.log).toHaveBeenCalledWith(
      JSON.stringify(mockCalendars, null, 2),
    );
  });

  it("should pass --group and --active filters", async () => {
    const mockClient = {
      calendars: { list: vi.fn().mockResolvedValue([]) },
    };
    mockGetActionContext.mockReturnValue({
      client: mockClient as any,
      outputMode: "json",
    });

    const program = createProgram();
    await program.parseAsync([
      "node",
      "miot",
      "calendar",
      "list",
      "--group",
      "vehicles",
      "--active",
    ]);

    expect(mockClient.calendars.list).toHaveBeenCalledWith({
      active: true,
      groupCode: "vehicles",
    });
  });

  it("should pass --inactive filter", async () => {
    const mockClient = {
      calendars: { list: vi.fn().mockResolvedValue([]) },
    };
    mockGetActionContext.mockReturnValue({
      client: mockClient as any,
      outputMode: "json",
    });

    const program = createProgram();
    await program.parseAsync([
      "node",
      "miot",
      "calendar",
      "list",
      "--inactive",
    ]);

    expect(mockClient.calendars.list).toHaveBeenCalledWith({
      active: false,
      groupCode: undefined,
    });
  });

  it("should print table output", async () => {
    const mockCalendars = [
      { id: "1", code: "test", name: "Test", timezone: "UTC", active: true, hasSlotManager: true },
    ];
    const mockClient = {
      calendars: { list: vi.fn().mockResolvedValue(mockCalendars) },
    };
    mockGetActionContext.mockReturnValue({
      client: mockClient as any,
      outputMode: "table",
    });

    const program = createProgram();
    await program.parseAsync(["node", "miot", "calendar", "list"]);

    // Should have header, separator, and row
    expect(console.log).toHaveBeenCalledTimes(3);
  });
});

describe("calendar get", () => {
  beforeEach(() => {
    vi.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should call calendars.get and print JSON", async () => {
    const mockCalendar = {
      id: "1",
      code: "test",
      name: "Test",
      timezone: "UTC",
      active: true,
    };
    const mockClient = {
      calendars: { get: vi.fn().mockResolvedValue(mockCalendar) },
    };
    mockGetActionContext.mockReturnValue({
      client: mockClient as any,
      outputMode: "json",
    });

    const program = createProgram();
    await program.parseAsync(["node", "miot", "calendar", "get", "1"]);

    expect(mockClient.calendars.get).toHaveBeenCalledWith("1");
    expect(console.log).toHaveBeenCalledWith(
      JSON.stringify(mockCalendar, null, 2),
    );
  });
});

describe("calendar create", () => {
  beforeEach(() => {
    vi.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should call calendars.create with flags", async () => {
    const mockCalendar = {
      id: "1",
      code: "new-cal",
      name: "New Calendar",
      timezone: "UTC",
      active: true,
    };
    const mockClient = {
      calendars: { create: vi.fn().mockResolvedValue(mockCalendar) },
    };
    mockGetActionContext.mockReturnValue({
      client: mockClient as any,
      outputMode: "json",
    });

    const program = createProgram();
    await program.parseAsync([
      "node",
      "miot",
      "calendar",
      "create",
      "--code",
      "new-cal",
      "--name",
      "New Calendar",
      "--timezone",
      "UTC",
    ]);

    expect(mockClient.calendars.create).toHaveBeenCalledWith({
      code: "new-cal",
      name: "New Calendar",
      timezone: "UTC",
      description: undefined,
    });
  });

  it("should pass autoSlotManager: false when --no-auto-slot-manager is set", async () => {
    const mockCalendar = {
      id: "1",
      code: "new-cal",
      name: "New Calendar",
      timezone: "UTC",
      active: true,
    };
    const mockClient = {
      calendars: { create: vi.fn().mockResolvedValue(mockCalendar) },
    };
    mockGetActionContext.mockReturnValue({
      client: mockClient as any,
      outputMode: "json",
    });

    const program = createProgram();
    await program.parseAsync([
      "node",
      "miot",
      "calendar",
      "create",
      "--code",
      "new-cal",
      "--name",
      "New Calendar",
      "--no-auto-slot-manager",
    ]);

    expect(mockClient.calendars.create).toHaveBeenCalledWith({
      code: "new-cal",
      name: "New Calendar",
      timezone: undefined,
      description: undefined,
      autoSlotManager: false,
    });
  });

  it("should pass groups when --group is provided", async () => {
    const mockCalendar = { id: "1", code: "c", name: "n", timezone: "UTC", active: true };
    const mockClient = {
      calendars: { create: vi.fn().mockResolvedValue(mockCalendar) },
    };
    mockGetActionContext.mockReturnValue({ client: mockClient as any, outputMode: "json" });

    const program = createProgram();
    await program.parseAsync([
      "node", "miot", "calendar", "create",
      "--code", "c", "--name", "n", "--group", "scl",
    ]);

    expect(mockClient.calendars.create).toHaveBeenCalledWith({
      code: "c",
      name: "n",
      timezone: undefined,
      description: undefined,
      groups: ["scl"],
    });
  });

  it("should pass multiple groups when --group is repeated", async () => {
    const mockCalendar = { id: "1", code: "c", name: "n", timezone: "UTC", active: true };
    const mockClient = {
      calendars: { create: vi.fn().mockResolvedValue(mockCalendar) },
    };
    mockGetActionContext.mockReturnValue({ client: mockClient as any, outputMode: "json" });

    const program = createProgram();
    await program.parseAsync([
      "node", "miot", "calendar", "create",
      "--code", "c", "--name", "n", "--group", "scl", "--group", "north",
    ]);

    expect(mockClient.calendars.create).toHaveBeenCalledWith({
      code: "c",
      name: "n",
      timezone: undefined,
      description: undefined,
      groups: ["scl", "north"],
    });
  });
});

describe("calendar update", () => {
  const mockCalendar = { id: "cal-1", code: "cal-1", name: "New Name", timezone: "UTC", active: true };

  beforeEach(() => {
    vi.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should call calendars.update with provided fields", async () => {
    const mockClient = {
      calendars: { update: vi.fn().mockResolvedValue(mockCalendar) },
    };
    mockGetActionContext.mockReturnValue({ client: mockClient as any, outputMode: "json" });

    const program = createProgram();
    await program.parseAsync([
      "node", "miot", "calendar", "update", "cal-1", "--name", "New Name",
    ]);

    expect(mockClient.calendars.update).toHaveBeenCalledWith("cal-1", { name: "New Name" });
  });

  it("should pass groups when --group is provided", async () => {
    const mockClient = {
      calendars: { update: vi.fn().mockResolvedValue(mockCalendar) },
    };
    mockGetActionContext.mockReturnValue({ client: mockClient as any, outputMode: "json" });

    const program = createProgram();
    await program.parseAsync([
      "node", "miot", "calendar", "update", "cal-1", "--group", "scl",
    ]);

    expect(mockClient.calendars.update).toHaveBeenCalledWith("cal-1", { groups: ["scl"] });
  });

  it("should pass multiple groups when --group is repeated", async () => {
    const mockClient = {
      calendars: { update: vi.fn().mockResolvedValue(mockCalendar) },
    };
    mockGetActionContext.mockReturnValue({ client: mockClient as any, outputMode: "json" });

    const program = createProgram();
    await program.parseAsync([
      "node", "miot", "calendar", "update", "cal-1", "--group", "scl", "--group", "north",
    ]);

    expect(mockClient.calendars.update).toHaveBeenCalledWith("cal-1", { groups: ["scl", "north"] });
  });

  it("should not include groups in body when --group is not provided", async () => {
    const mockClient = {
      calendars: { update: vi.fn().mockResolvedValue(mockCalendar) },
    };
    mockGetActionContext.mockReturnValue({ client: mockClient as any, outputMode: "json" });

    const program = createProgram();
    await program.parseAsync([
      "node", "miot", "calendar", "update", "cal-1", "--name", "New Name",
    ]);

    expect(mockClient.calendars.update).toHaveBeenCalledWith(
      "cal-1",
      expect.not.objectContaining({ groups: expect.anything() }),
    );
  });
});

describe("calendar purge", () => {
  beforeEach(() => {
    vi.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should call calendars.purge and print JSON success", async () => {
    const mockClient = {
      calendars: { purge: vi.fn().mockResolvedValue(undefined) },
    };
    mockGetActionContext.mockReturnValue({
      client: mockClient as any,
      outputMode: "json",
    });

    const program = createProgram();
    await program.parseAsync(["node", "miot", "calendar", "purge", "cal-1"]);

    expect(mockClient.calendars.purge).toHaveBeenCalledWith("cal-1");
    expect(console.log).toHaveBeenCalledWith(
      JSON.stringify({ success: true }, null, 2),
    );
  });

  it("should print success message in table mode", async () => {
    const mockClient = {
      calendars: { purge: vi.fn().mockResolvedValue(undefined) },
    };
    mockGetActionContext.mockReturnValue({
      client: mockClient as any,
      outputMode: "table",
    });

    const program = createProgram();
    await program.parseAsync(["node", "miot", "calendar", "purge", "cal-1"]);

    expect(console.log).toHaveBeenCalledWith("Calendar cal-1 permanently deleted.");
  });
});

describe("calendar deactivate", () => {
  beforeEach(() => {
    vi.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should call calendars.deactivate", async () => {
    const mockClient = {
      calendars: { deactivate: vi.fn().mockResolvedValue(undefined) },
    };
    mockGetActionContext.mockReturnValue({
      client: mockClient as any,
      outputMode: "json",
    });

    const program = createProgram();
    await program.parseAsync([
      "node",
      "miot",
      "calendar",
      "deactivate",
      "cal-1",
    ]);

    expect(mockClient.calendars.deactivate).toHaveBeenCalledWith("cal-1");
    expect(console.log).toHaveBeenCalledWith(
      JSON.stringify({ success: true }, null, 2),
    );
  });
});
