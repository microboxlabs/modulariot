import { afterEach, describe, expect, it } from "vitest";
import { isPastFormsEnabled } from "./past-forms";

const KEY = "NEXT_PUBLIC_SYMPTOMS_PAST_FORMS";

describe("isPastFormsEnabled", () => {
  const previous = process.env[KEY];

  afterEach(() => {
    if (previous === undefined) {
      delete process.env[KEY];
    } else {
      process.env[KEY] = previous;
    }
  });

  it("is on only when the variable is the string true", () => {
    process.env[KEY] = "true";
    expect(isPastFormsEnabled()).toBe(true);

    process.env[KEY] = "false";
    expect(isPastFormsEnabled()).toBe(false);

    delete process.env[KEY];
    expect(isPastFormsEnabled()).toBe(false);
  });
});
