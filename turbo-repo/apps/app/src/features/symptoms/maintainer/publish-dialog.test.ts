import { describe, expect, it } from "vitest";
import { ControlTowerError } from "../control-tower/control-tower-api";
import { nextVersion, publishError } from "./publish-dialog";

describe("nextVersion", () => {
  it("raises the version by its bump", () => {
    expect(nextVersion("2.1.0", "MAJOR")).toBe("3.0.0");
    expect(nextVersion("2.1.3", "MINOR")).toBe("2.2.0");
    expect(nextVersion("2.1.3", "PATCH")).toBe("2.1.4");
    expect(nextVersion("0.9.9", "MINOR")).toBe("0.10.0");
  });
});

describe("publishError", () => {
  const d = {
    publishConflict: "conflict",
    ownersOnlyChange: "owners",
    actionFailed: "failed",
  };
  it("reads the status, never the server's text", () => {
    expect(publishError(new ControlTowerError("x", 409), d)).toBe("conflict");
    expect(publishError(new ControlTowerError("x", 403), d)).toBe("owners");
    expect(publishError(new Error("boom"), d)).toBe("failed");
  });
});
