import { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { useRowKeys } from "./use-row-keys";

function Rows() {
  const [rows, setRows] = useState(["first", "second"]);
  const keys = useRowKeys(rows.length);
  return (
    <>
      {rows.map((row, i) => (
        <input key={keys.keys[i]} aria-label={row} defaultValue={row} />
      ))}
      <button
        onClick={() => {
          keys.remove(0);
          setRows(rows.slice(1));
        }}
      >
        Remove
      </button>
      <button
        onClick={() => {
          keys.append();
          setRows([...rows, "third"]);
        }}
      >
        Add
      </button>
    </>
  );
}

it("keeps the surviving input identity and state after removal and insertion", () => {
  render(<Rows />);
  const second = screen.getByLabelText("second");
  fireEvent.change(second, { target: { value: "edited" } });
  fireEvent.click(screen.getByText("Remove"));
  expect(screen.getByLabelText("second")).toBe(second);
  expect(second).toHaveValue("edited");
  fireEvent.click(screen.getByText("Add"));
  expect(screen.getByLabelText("second")).toBe(second);
  expect(screen.getByLabelText("third")).not.toBe(second);
});
