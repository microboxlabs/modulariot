import { MiotCalendarApiError } from "@microboxlabs/miot-calendar-client";
import { MiotConnectionApiError } from "@microboxlabs/miot-connection-client";
import { MiotHarnessApiError } from "@microboxlabs/miot-harness-client";
import type { OutputMode } from "../config.js";

export function handleError(err: unknown, outputMode: OutputMode): never {
  if (err instanceof MiotCalendarApiError || err instanceof MiotConnectionApiError) {
    const message =
      typeof err.body === "string"
        ? err.body
        : err.body.message ?? "Unknown error";

    if (outputMode === "json") {
      console.log(
        JSON.stringify(
          { error: { status: err.status, message } },
          null,
          2,
        ),
      );
    } else {
      console.error(`Error (${err.status}): ${message}`);
    }

    process.exit(err.status >= 500 ? 2 : 1);
  }

  if (err instanceof MiotHarnessApiError) {
    if (outputMode === "json") {
      console.log(
        JSON.stringify(
          {
            error: {
              code: err.code,
              status: err.status,
              run_id: err.runId,
              message: err.message,
            },
          },
          null,
          2,
        ),
      );
    } else {
      const status = err.status ? ` (${err.status})` : "";
      const run = err.runId ? ` [run=${err.runId}]` : "";
      console.error(`Error ${err.code}${status}${run}: ${err.message}`);
    }
    process.exit(err.status !== undefined && err.status >= 500 ? 2 : 1);
  }

  const message = err instanceof Error ? err.message : String(err);

  if (outputMode === "json") {
    console.log(JSON.stringify({ error: { message } }, null, 2));
  } else {
    console.error(`Error: ${message}`);
  }

  process.exit(1);
}
