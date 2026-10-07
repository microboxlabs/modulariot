import { describe, expect, it } from "vitest";
import {
  insertVariable,
  isOwnTemplate,
  sourceKey,
  templateUrl,
  type MailTemplate,
} from "./mail-template-model";

function template(source: MailTemplate["source"]): MailTemplate {
  return {
    kind: "invitation",
    lang: "es",
    source,
    subject: "s",
    html: "{{link}}",
    updatedAt: null,
    updatedBy: null,
    variables: ["link"],
  };
}

describe("templateUrl", () => {
  it("points the platform at the admin proxy and an organization at its own", () => {
    expect(templateUrl("platform", "es")).toBe(
      "/app/api/admin/platform/mail-templates/invitation/es"
    );
    expect(templateUrl("organization", "en")).toBe(
      "/app/api/mail-templates/invitation/en"
    );
  });
});

describe("template source", () => {
  it("is the scope's own only when it was saved there", () => {
    expect(isOwnTemplate("platform", template("PLATFORM"))).toBe(true);
    expect(isOwnTemplate("organization", template("PLATFORM"))).toBe(false);
    expect(isOwnTemplate("organization", template("ORGANIZATION"))).toBe(true);
  });

  it("names where an inherited template comes from", () => {
    expect(sourceKey("organization", template("PLATFORM"))).toBe(
      "sourcePlatform"
    );
    expect(sourceKey("platform", template("DEFAULT"))).toBe("sourceDefault");
    expect(sourceKey("platform", template("PLATFORM"))).toBe("sourceOwn");
  });
});

describe("insertVariable", () => {
  it("replaces the selection and puts the caret after the variable", () => {
    expect(insertVariable("Hola X!", "inviter", 5, 6)).toEqual({
      text: "Hola {{inviter}}!",
      caret: 16,
    });
  });
});
