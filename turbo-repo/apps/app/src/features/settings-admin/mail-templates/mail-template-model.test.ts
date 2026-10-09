import { describe, expect, it } from "vitest";
import {
  handlebarsCompletions,
  insertVariable,
  isOwnTemplate,
  problemOffset,
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

describe("handlebarsCompletions", () => {
  const vars = ["organization", "link"];

  it("offers variables after {{ and blocks after {{# or {{/", () => {
    expect(handlebarsCompletions("{{or", vars)).toEqual({
      offset: 2,
      kind: "variable",
      names: vars,
    });
    expect(handlebarsCompletions("{{# i", vars)?.kind).toBe("open");
    expect(handlebarsCompletions("{{# i", vars)?.offset).toBe(4);
    expect(handlebarsCompletions("{{/", vars)?.kind).toBe("close");
  });

  it("offers nothing outside a mustache", () => {
    expect(handlebarsCompletions("<div", vars)).toBeNull();
  });
});

describe("problemOffset", () => {
  it("finds the line and column Handlebars reports", () => {
    const doc = "<p>\n  {{#if x}}\n</p>";
    expect(problemOffset("inline@1a2b:2:2: missing {{/if}}", doc)).toBe(6);
  });

  it("falls back to the start without a position", () => {
    expect(problemOffset("subject is required", "abc")).toBe(0);
  });
});
