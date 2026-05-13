# CLI Conventions (Layer 2)

## Package: `miot-cli`

Path: `packages/miot-cli/`

### File layout

```
src/
├── commands/
│   └── <resource>/
│       ├── index.ts          ← registers all sub-commands; houses simple read commands (list, get)
│       ├── create.ts         ← registerCreateCommand + registerUpdateCommand + registerDeactivateCommand + registerPurgeCommand
│       └── <other>.ts
├── utils/
│   ├── error.ts              ← handleError(err, outputMode)
│   └── parse.ts              ← parseIntOrThrow, parseOptionalInt
└── output.ts                 ← printJson, printDetail, printTable, printSuccess
```

### Action handler pattern

Every command follows this structure exactly:

```typescript
export function registerXxxCommand(parent: Command): void {
  parent
    .command("xxx <id>")
    .description("...")
    .option("--flag <val>", "description")
    .action(async (id: string, _opts, cmd) => {
      const { client, outputMode } = getActionContext(cmd);
      try {
        const opts = cmd.opts() as { flag?: string };
        const result = await client.resource.method(id, opts);
        if (outputMode === "json") printJson(result);
        else printDetail(result);
      } catch (err) {
        handleError(err, outputMode);
      }
    });
}
```

### Void / 204 pattern

For endpoints that return 204 No Content, wrap the void result in `{ success: true }`:

```typescript
await client.calendars.purge(id);
if (outputMode === "json") printJson({ success: true });
else printSuccess(`Calendar ${id} permanently deleted.`);
```

### Boolean negation flag

Use Commander's `--no-<flag>` pattern for boolean options:

```typescript
.option("--no-auto-slot-manager", "Skip auto-provisioning")
// In action: opts.autoSlotManager is false when --no-auto-slot-manager is passed
// Only include in request body when explicitly false:
...(opts.autoSlotManager === false && { autoSlotManager: false }),
```

### Adding a new table column

In list commands, append to the columns array passed to `printTable`:

```typescript
printTable(results, [
  { header: "ID",       key: "id" },
  { header: "NEW COL",  key: "newField" },  // ← add here
]);
```

### Registering a new command in `index.ts`

```typescript
import { registerNewCommand } from "./create.js";
// ...
registerNewCommand(calendarCmd);
```

### Test patterns

Mirror `calendar-list.test.ts`. Create a mock client with `vi.fn()`, call `program.parseAsync`, assert on mock invocations and `console.log`:

```typescript
it("calls purge with the correct id", async () => {
  const mockPurge = vi.fn().mockResolvedValue(undefined);
  vi.mocked(createMiotCalendarClient).mockReturnValue({
    calendars: { purge: mockPurge },
  } as unknown as MiotCalendarClient);

  await program.parseAsync(["node", "miot", "calendar", "purge", "cal-1"]);

  expect(mockPurge).toHaveBeenCalledWith("cal-1");
});
```

### Version bump rules

| Change | Bump |
|---|---|
| New command added | minor |
| New flag or table column only | patch |

### Running tests

```bash
npm run test --workspace=packages/miot-cli
```
