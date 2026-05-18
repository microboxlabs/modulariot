import type { Command } from "commander";
import { resolveConfig, type CliFlags } from "../config.js";
import { createHarnessClient } from "../harness/client.js";
import { HarnessRunError } from "../harness/types.js";
import { dim, red, type ColorOptions } from "../output.js";
import {
  clearStatus,
  initialState,
  renderAuthoritativeAnswer,
  renderEvent,
  type RenderState,
} from "../repl/renderer.js";

export function registerRunsCommand(program: Command): void {
  program
    .command("runs <run_id>")
    .description("Offline replay of a completed run: GET /runs/{id} and render all events.")
    .action(async (runId: string) => {
      const flags = program.opts<CliFlags>();
      const config = resolveConfig({ flags });
      const color: ColorOptions = {
        noColor: Boolean(process.env.NO_COLOR),
        isTTY: process.stdout.isTTY,
      };

      const client = createHarnessClient({
        baseUrl: config.baseUrl,
        token: config.token,
      });

      try {
        const record = await client.getRun(runId);
        process.stdout.write(
          `${dim(`run ${runId} — status: ${record.status} — events: ${record.events.length}`, color)}\n`,
        );

        let state: RenderState = initialState(color);
        for (const event of record.events) {
          const r = renderEvent(state, event);
          state = r.state;
          if (r.output.length > 0) process.stdout.write(r.output);
        }
        const cleared = clearStatus(state);
        if (cleared.output.length > 0) process.stdout.write(cleared.output);
        const final = renderAuthoritativeAnswer(cleared.state, record.answer);
        process.stdout.write(final.output);
        process.exit(record.status === "failed" ? 1 : 0);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        process.stderr.write(`${red(`error: ${msg}`, color)}\n`);
        process.exit(e instanceof HarnessRunError ? 1 : 2);
      }
    });
}
