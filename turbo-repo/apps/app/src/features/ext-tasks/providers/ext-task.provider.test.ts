import { describe, expect, it } from "vitest";
import type { ExternalTask } from "../ext-task.types";
import { ExtTaskError, validateAndGetTask } from "./ext-task.provider";

function encode(value: unknown): string {
  return Buffer.from(JSON.stringify(value), "utf-8").toString("base64url");
}

const future = new Date(Date.now() + 60_000).toISOString();
const past = new Date(Date.now() - 60_000).toISOString();

const task: ExternalTask = {
  taskType: "confirm-visit",
  payload: { visitId: "v-1" },
  expiresAt: future,
};

describe("validateAndGetTask", () => {
  it("resolves a valid token to its task", async () => {
    const result = validateAndGetTask(encode(task), "confirm-visit");
    expect(result).toBeInstanceOf(Promise);
    await expect(result).resolves.toEqual(task);
  });

  it.each([
    {
      name: "invalid JSON",
      token: Buffer.from("not json").toString("base64url"),
      message: "Invalid token",
      statusCode: 404,
    },
    {
      name: "another task type",
      token: encode({ ...task, taskType: "other" }),
      message: "Token task type mismatch",
      statusCode: 400,
    },
    {
      name: "an expired token",
      token: encode({ ...task, expiresAt: past }),
      message: "Token has expired",
      statusCode: 410,
    },
    {
      name: "a token without expiry",
      token: encode({ taskType: task.taskType, payload: {} }),
      message: "Token has expired",
      statusCode: 410,
    },
  ])(
    "rejects $name without throwing",
    async ({ token, message, statusCode }) => {
      let result: Promise<ExternalTask> = Promise.resolve(task);
      expect(() => {
        result = validateAndGetTask(token, "confirm-visit");
      }).not.toThrow();
      await expect(result).rejects.toBeInstanceOf(ExtTaskError);
      await expect(result).rejects.toMatchObject({ message, statusCode });
    }
  );
});
