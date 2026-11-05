import { useState } from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { Value } from "react-phone-number-input";
import PhoneInput from "./phone-input";

vi.mock("next/navigation", () => ({ useParams: () => ({ lang: "es" }) }));

function Controlled({
  onValue,
}: Readonly<{ onValue: (v: Value | undefined) => void }>) {
  const [value, setValue] = useState<Value | undefined>();
  return (
    <PhoneInput
      id="phone"
      defaultCountry="CL"
      value={value}
      onChange={(v) => {
        setValue(v);
        onValue(v);
      }}
    />
  );
}

describe("PhoneInput", () => {
  // jsdom doesn't reproduce the library's as-you-type formatting (it depends
  // on browser caret handling), so only the returned value is asserted.
  it("starts from the default country's code and returns E.164", async () => {
    const user = userEvent.setup();
    const onValue = vi.fn();
    render(<Controlled onValue={onValue} />);
    expect(screen.getByRole("textbox")).toHaveValue("+56");
    await user.type(screen.getByRole("textbox"), "912345678");
    expect(onValue).toHaveBeenLastCalledWith("+56912345678");
  });

  it.each(["+56 9 1234 5678", "9 1234 5678", "56912345678"])(
    "takes a pasted number with its spaces: %s",
    async (pasted) => {
      const user = userEvent.setup();
      const onValue = vi.fn();
      render(<Controlled onValue={onValue} />);
      await user.click(screen.getByRole("textbox"));
      await user.paste(pasted);
      expect(onValue).toHaveBeenLastCalledWith("+56912345678");
    }
  );

  it("uses the selected country for a national-number paste", async () => {
    const user = userEvent.setup();
    const onValue = vi.fn();
    render(<Controlled onValue={onValue} />);
    await user.click(screen.getAllByRole("button")[0] as HTMLElement);
    await user.click(
      within(await screen.findByRole("menu")).getByRole("button", {
        name: /Perú/,
      })
    );
    await user.click(screen.getByRole("textbox"));
    await user.paste("912345678");
    expect(onValue).toHaveBeenLastCalledWith("+51912345678");
  });

  it("lists countries with their calling code in the app's language", async () => {
    const user = userEvent.setup();
    render(<Controlled onValue={vi.fn()} />);
    await user.click(screen.getAllByRole("button")[0] as HTMLElement);
    expect((await screen.findAllByText("Argentina")).length).toBeGreaterThan(0);
    expect(screen.getAllByText("(+54)").length).toBeGreaterThan(0);
  });

  it("opens the country menu as wide as the whole field", async () => {
    const user = userEvent.setup();
    render(<Controlled onValue={vi.fn()} />);
    await user.click(screen.getAllByRole("button")[0] as HTMLElement);
    const menu = await screen.findByTestId("flowbite-dropdown");
    expect(menu).toHaveClass("w-full");
    expect(menu.parentElement).toHaveClass("relative");
  });
});
