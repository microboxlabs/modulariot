import { MiotCalendarApiError } from "@microboxlabs/miot-calendar-client";
import { MiotConnectionApiError } from "@microboxlabs/miot-connection-client";
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

  const message = err instanceof Error ? err.message : String(err);

  if (outputMode === "json") {
    console.log(JSON.stringify({ error: { message } }, null, 2));
  } else {
    console.error(`Error: ${message}`);
  }

  process.exit(1);
}
