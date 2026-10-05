import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import MetaTable from "./meta-table";

type Fila = { k: string; v: string };

function Harness({ initial, max = 10 }: { initial: Fila[]; max?: number }) {
  const [rows, setRows] = useState(initial);
  return <MetaTable rows={rows} max={max} onRowsChange={setRows} />;
}

const enter = (el: HTMLElement) => fireEvent.keyDown(el, { key: "Enter" });

describe("MetaTable", () => {
  it("Enter on a key moves to its value", () => {
    render(<Harness initial={[{ k: "a", v: "" }]} />);
    enter(screen.getByLabelText("Clave 1"));
    expect(screen.getByLabelText("Valor 1")).toHaveFocus();
  });

  it("Enter on a value moves to the next row's key", () => {
    render(
      <Harness
        initial={[
          { k: "a", v: "1" },
          { k: "b", v: "2" },
        ]}
      />
    );
    enter(screen.getByLabelText("Valor 1"));
    expect(screen.getByLabelText("Clave 2")).toHaveFocus();
  });

  it("Enter on the last value creates a new row and focuses it", () => {
    render(<Harness initial={[{ k: "a", v: "1" }]} />);
    enter(screen.getByLabelText("Valor 1"));
    expect(screen.getByLabelText("Clave 2")).toHaveFocus();
  });

  it("does not create a row when the last key is empty", () => {
    render(<Harness initial={[{ k: "", v: "x" }]} />);
    enter(screen.getByLabelText("Valor 1"));
    expect(screen.queryByLabelText("Clave 2")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Clave 1")).toHaveFocus();
  });

  it("stops creating rows at the maximum", () => {
    render(<Harness initial={[{ k: "a", v: "1" }]} max={1} />);
    enter(screen.getByLabelText("Valor 1"));
    expect(screen.queryByLabelText("Clave 2")).not.toBeInTheDocument();
    expect(screen.getByText("Máximo alcanzado")).toBeInTheDocument();
  });

  it("unfolds the list when Enter moves into a hidden row", () => {
    render(
      <Harness initial={["a", "b", "c", "d"].map((k) => ({ k, v: "1" }))} />
    );
    expect(screen.queryByLabelText("Clave 4")).not.toBeInTheDocument();
    enter(screen.getByLabelText("Valor 3"));
    expect(screen.getByLabelText("Clave 4")).toHaveFocus();
  });
});
