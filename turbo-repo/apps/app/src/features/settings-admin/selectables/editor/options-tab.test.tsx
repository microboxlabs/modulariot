import { useState } from "react";
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { emptyDraft, type Draft } from "./editor-draft";
import { OptionsTab } from "./options-tab";

function Harness() {
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  return <OptionsTab draft={draft} onChange={setDraft} d={{}} lang="es" />;
}

describe("OptionsTab", () => {
  it("adds a row when Tab leaves the last row's last label, and focuses it", async () => {
    render(<Harness />);
    const labels = () => screen.getAllByPlaceholderText("labelPlaceholder");
    expect(labels()).toHaveLength(2);

    await userEvent.type(labels()[0]!, "Tráfico");
    await userEvent.click(labels()[1]!);
    await userEvent.tab();

    expect(labels()).toHaveLength(4);
    expect(labels()[2]).toHaveFocus();
    expect(
      screen.getAllByRole("textbox", { name: "valueLabel" })[0]
    ).toHaveValue("trafico");
  });

  it("leaves Tab alone on earlier rows and with Shift", async () => {
    render(<Harness />);
    const labels = () => screen.getAllByPlaceholderText("labelPlaceholder");
    await userEvent.click(labels()[1]!);
    await userEvent.tab({ shift: true });

    expect(labels()).toHaveLength(2);
  });
});
