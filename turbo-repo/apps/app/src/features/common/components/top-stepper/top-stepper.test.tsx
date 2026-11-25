import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import TopStepper from "./top-stepper";

const steps = [{ title: "Profile" }, { title: "Tags" }, { title: "Done" }];

describe("TopStepper", () => {
  it("numbers the steps, ticks the finished ones and marks the current one", () => {
    render(<TopStepper steps={steps} currentStepIndex={1} />);
    const items = screen.getAllByRole("listitem");
    expect(items.map((item) => item.textContent)).toEqual([
      "Profile",
      "2Tags",
      "3Done",
    ]);
    expect(items[1]!.querySelector('[aria-current="step"]')).not.toBeNull();
  });

  it("lets reached steps be opened again, and not the ones ahead", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(
      <TopStepper
        steps={steps}
        currentStepIndex={0}
        reachedStepIndex={1}
        onSelect={onSelect}
      />
    );
    await user.click(screen.getByRole("button", { name: /Tags/ }));
    expect(onSelect).toHaveBeenCalledWith(1);
    expect(screen.getByRole("button", { name: /Done/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: /Profile/ })).toHaveAttribute(
      "aria-current",
      "step"
    );
  });

  it("keeps steps ahead of the current one grey, even when visited", () => {
    render(
      <TopStepper
        steps={steps}
        currentStepIndex={0}
        reachedStepIndex={2}
        onSelect={vi.fn()}
      />
    );
    const tags = screen.getByRole("button", { name: /Tags/ });
    expect(tags).toBeEnabled();
    // A number, not a tick: it is not done while it lies ahead.
    expect(tags).toHaveTextContent("2Tags");
    expect(tags.querySelector("span")).toHaveClass("border-gray-400");
    expect(
      screen.getByRole("button", { name: /Profile/ }).querySelector("span")
    ).toHaveClass("bg-blue-700");
  });
});
