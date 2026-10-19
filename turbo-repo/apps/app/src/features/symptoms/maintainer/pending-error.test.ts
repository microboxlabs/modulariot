import { describe, expect, it } from "vitest";
import { ControlTowerError } from "../control-tower/control-tower-api";
import { pendingError } from "./pending-error";

const d = {
  nameTaken: "name taken",
  ownersOnlyChange: "owners only",
  actionFailed: "failed",
};

describe("pendingError", () => {
  it("reads a 409 on a copy as a name in use", () => {
    expect(pendingError(new ControlTowerError("x", 409), "fork", d)).toBe(
      "name taken"
    );
  });

  it("does not read a 409 on a revert as a name in use", () => {
    expect(pendingError(new ControlTowerError("x", 409), "rollback", d)).toBe(
      "failed"
    );
  });

  it("says only owners may change symptoms on a 403", () => {
    expect(pendingError(new ControlTowerError("x", 403), "rollback", d)).toBe(
      "owners only"
    );
  });

  it("never shows the server's text", () => {
    expect(pendingError(new Error("boom"), "fork", d)).toBe("failed");
    expect(pendingError("boom", "fork", d)).toBe("failed");
  });
});
