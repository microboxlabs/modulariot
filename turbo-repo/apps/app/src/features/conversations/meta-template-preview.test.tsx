import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { MetaTemplateButton } from "./conversations-types";
import MetaTemplatePreview from "./meta-template-preview";

describe("MetaTemplatePreview", () => {
  it("shows a button type it has no icon for", () => {
    // Meta lists types the editor does not offer, such as COPY_CODE.
    const copyCode = {
      type: "COPY_CODE",
      text: "Copiar código",
    } as unknown as MetaTemplateButton;
    render(
      <MetaTemplatePreview
        label="Vista previa"
        draft={{
          name: "promo",
          language: "es_CL",
          category: "MARKETING",
          header: "",
          body: "Tu código está listo.",
          footer: "",
          buttons: [copyCode],
          examples: {},
        }}
      />
    );
    expect(screen.getByText("Copiar código")).toBeTruthy();
  });
});
