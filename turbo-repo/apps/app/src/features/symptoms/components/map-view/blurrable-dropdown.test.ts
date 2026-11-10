import { describe, expect, it } from "vitest";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import es from "@/lang/es.json";
import { buildOtherOptions } from "./blurrable-dropdown";

const dict = es as I18nRecord;

describe("buildOtherOptions", () => {
  it("leaves 'Registrar gestión' out by default, as the call flow uses it", () => {
    expect(buildOtherOptions(dict).map((o) => o.option)).not.toContain(
      "record_handling"
    );
  });

  it("adds an enabled 'Registrar gestión' when asked", () => {
    const entry = buildOtherOptions(dict, { recordHandling: true }).find(
      (o) => o.option === "record_handling"
    );

    expect(entry?.label).toBe("Registrar gestión");
    expect(entry?.disabled).toBeFalsy();
  });
});
