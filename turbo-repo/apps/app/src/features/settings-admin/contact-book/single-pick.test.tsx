import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { HiOutlineOfficeBuilding } from "react-icons/hi";
import { describe, expect, it, vi } from "vitest";
import SinglePick from "./single-pick";

describe("SinglePick keyboard selection", () => {
  it("keeps a non-exact option available when tabbing out of the search", async () => {
    const user = userEvent.setup();
    const onPick = vi.fn();
    function Picker() {
      const [query, setQuery] = useState("");
      return (
        <SinglePick
          value=""
          icon={HiOutlineOfficeBuilding}
          options={[{ label: "Example Company" }]}
          query={query}
          onQuery={setQuery}
          onPick={onPick}
          onCreate={vi.fn()}
          onClear={vi.fn()}
          texts={{
            label: "Company",
            placeholder: "Search",
            remove: "Remove",
            create: (name) => `Create ${name}`,
            empty: "No companies",
          }}
        />
      );
    }
    render(<Picker />);
    await user.type(screen.getByRole("textbox", { name: "Company" }), "Exam");
    await user.tab();
    expect(
      screen.getByRole("button", { name: "Example Company" })
    ).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(onPick).toHaveBeenCalledWith({ label: "Example Company" });
  });
});
