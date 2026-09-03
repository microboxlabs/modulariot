import { describe, expect, it } from "vitest";
import { createRefusalLog } from "./refusal-log";

function harness(intervalMs = 10_000) {
  const lines: Record<string, unknown>[] = [];
  let clock = 1_000_000;
  const refused = createRefusalLog({
    write: (line) => lines.push(line),
    intervalMs,
    now: () => clock,
  });
  return {
    lines,
    refused,
    advance: (ms: number) => {
      clock += ms;
    },
  };
}

describe("createRefusalLog", () => {
  it("writes the first refusal straight away", () => {
    const { lines, refused } = harness();
    refused("token has expired");
    expect(lines).toEqual([
      { level: "warn", msg: "credential refused", reason: "token has expired" },
    ]);
  });

  it("does not write a line per request while the flood lasts", () => {
    // An anonymous caller must not decide how much this process logs.
    const { lines, refused } = harness();
    for (let i = 0; i < 10_000; i += 1) refused("signature does not verify");
    expect(lines).toHaveLength(1);
  });

  it("says how many it folded into the next line", () => {
    const { lines, refused, advance } = harness();
    refused("token has expired");
    refused("token has expired");
    refused("token has expired");

    advance(10_000);
    refused("token has expired");

    expect(lines).toHaveLength(2);
    expect(lines[1]).toMatchObject({ alsoRefused: 2 });
  });

  it("keeps a rare reason visible behind a common one", () => {
    // The misconfiguration is the line worth reading, and it must not be
    // hidden by whatever is arriving in volume.
    const { lines, refused } = harness();
    for (let i = 0; i < 100; i += 1) refused("signature does not verify");
    refused('the token carries no usable "tenant_id" claim');

    expect(lines.map((line) => line.reason)).toEqual([
      "signature does not verify",
      'the token carries no usable "tenant_id" claim',
    ]);
  });

  it("does not grow without bound on reasons a caller invents", () => {
    // Some reasons quote the token: the algorithm it claims, the key id it
    // names. A table keyed by reason is otherwise the same unbounded growth
    // this module exists to prevent.
    const { lines, refused } = harness();
    for (let i = 0; i < 5_000; i += 1)
      refused(`no verification key with id ${i}`);

    // 32 distinct reasons tracked, and everything past that folded into one.
    expect(lines).toHaveLength(33);
    expect(lines.at(-1)).toMatchObject({ reason: "other credential refusals" });
  });
});
