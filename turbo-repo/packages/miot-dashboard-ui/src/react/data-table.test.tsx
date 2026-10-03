// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { DataTable, type DataTableProps } from "./data-table";
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
function props(): DataTableProps {
  return {
    columns: [
      { key: "service", label: "Service", type: "text", sticky: true },
      { key: "cost", label: "Cost", type: "signed" },
      { key: "share", label: "Share", type: "progress", sticky: true },
    ],
    rows: [{ id: "one", service: "<img>", cost: "-2", share: "25" }],
    label: "Costs",
    emptyLabel: "No rows",
    loadingLabel: "Loading",
    actionsLabel: "Actions",
    resolveValue: (key, row) => row[key] ?? "",
  };
}
it("renders literal cells, decorators and host headers/actions over provided rows", () => {
  const options = props();
  const view = render(
    <DataTable
      {...options}
      columns={options.columns.map((col) => ({
        ...col,
        decorator: col.key === "cost" ? "USD" : undefined,
      }))}
      renderHeader={(_, label) => <span>{label}</span>}
      renderActions={(row) => <a href={`#${row.id}`}>View</a>}
    />,
  );
  expect(screen.getByRole("table", { name: "Costs" })).toBeTruthy();
  expect(screen.getByRole("columnheader", { name: "Service" })).toBeTruthy();
  expect(screen.getByText("<img>")).toBeTruthy();
  expect(view.container.querySelector("img")).toBeNull();
  expect(screen.getByText("USD")).toBeTruthy();
  expect(screen.getByRole("link").getAttribute("href")).toBe("#one");
  expect(screen.getByRole("progressbar").getAttribute("value")).toBe("25");
});
it("measures unscaled sticky groups including action width, then updates after columns change", () => {
  vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockImplementation(
    function (this: HTMLElement) {
      return this.textContent === "Actions" ? 40 : 100;
    },
  );
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
    function (this: HTMLElement) {
      return {
        width: this.textContent === "Actions" ? 20 : 50,
        height: 30,
        top: 0,
        left: 0,
        right: 100,
        bottom: 30,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      };
    },
  );
  const options = props();
  const view = render(
    <DataTable
      {...options}
      renderActions={() => <button type="button">Open</button>}
    />,
  );
  const first = screen.getByRole("columnheader", { name: "Service" });
  const last = screen.getByRole("columnheader", { name: "Share" });
  expect(first.style.left).toBe("0px");
  expect(last.style.right).toBe("40px");
  view.rerender(
    <DataTable
      {...options}
      columns={options.columns.map((c) => ({ ...c, sticky: true }))}
    />,
  );
  expect(screen.getByRole("columnheader", { name: "Share" }).style.left).toBe(
    "200px",
  );
  expect(screen.getByRole("columnheader", { name: "Share" }).style.right).toBe(
    "",
  );
});
it("hides rows during loading/errors and renders an empty state after recovery", () => {
  const options = props();
  const view = render(<DataTable {...options} loading />);
  expect(screen.getByRole("status").textContent).toBe("Loading");
  expect(screen.queryByRole("table")).toBeNull();
  view.rerender(<DataTable {...options} errorLabel="Unavailable" />);
  expect(screen.getByRole("alert").textContent).toBe("Unavailable");
  expect(screen.queryByText("<img>")).toBeNull();
  view.rerender(<DataTable {...options} rows={[]} />);
  expect(screen.getByRole("cell").getAttribute("colspan")).toBe("3");
  expect(screen.getByText("No rows")).toBeTruthy();
});

it("supports validated hex row tints without dropping legacy color names", () => {
  const view = render(<DataTable {...props()} rowColor={() => "ef4444"} />);
  const row = screen.getAllByRole("row")[1]!;
  expect(row.style.getPropertyValue("--miot-row-background")).toBe(
    "color-mix(in srgb, #ef4444 12%, var(--miot-card-background, #fff))",
  );
  view.rerender(<DataTable {...props()} rowColor={() => "red"} />);
  expect(row.dataset.rowColor).toBe("red");
  expect(row.style.getPropertyValue("--miot-row-background")).toBe("");
  view.rerender(<DataTable {...props()} rowColor={() => "url(secret)"} />);
  expect(row.style.getPropertyValue("--miot-row-background")).toBe("");
});
it("resizes with keyboard controls and persists only editor changes", () => {
  vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockImplementation(
    function (this: HTMLElement) {
      return this.tagName === "TABLE" ? 600 : 100;
    },
  );
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
    width: 50,
    height: 20,
    left: 0,
    top: 0,
    right: 100,
    bottom: 20,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  });
  const onCommit = vi.fn();
  const options = props();
  const resizing = {
    editable: true,
    onCommit,
    handleLabel: (label: string) => `Resize ${label}`,
  };
  const view = render(<DataTable {...options} resizing={resizing} />);
  const handle = screen.getByRole("button", { name: "Resize Service" });
  expect(screen.queryByRole("button", { name: "Resize Share" })).toBeNull();
  fireEvent.keyDown(handle, { key: "ArrowRight" });
  expect(onCommit).toHaveBeenLastCalledWith({ service: 110, cost: 100 });
  expect(screen.getByRole("table").style.tableLayout).toBe("fixed");
  view.rerender(
    <DataTable {...options} resizing={{ ...resizing, editable: false }} />,
  );
  fireEvent.keyDown(handle, { key: "ArrowLeft", shiftKey: true });
  expect(onCommit).toHaveBeenCalledOnce();
  expect(view.container.querySelector("col")?.style.width).toBe("80px");
  fireEvent.click(handle, { detail: 0 });
  expect(view.container.querySelector("col")?.style.width).toBe("100px");
  expect(onCommit).toHaveBeenCalledOnce();
});
it("tracks pointer resize and cancels without saving when the pointer is interrupted", () => {
  vi.stubGlobal("PointerEvent", MouseEvent);
  vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockImplementation(
    function (this: HTMLElement) {
      return this.tagName === "TABLE" ? 600 : 100;
    },
  );
  const onCommit = vi.fn();
  render(
    <DataTable
      {...props()}
      resizing={{
        editable: true,
        onCommit,
        handleLabel: (label) => `Resize ${label}`,
      }}
    />,
  );
  const handle = screen.getByRole("button", { name: "Resize Service" });
  fireEvent.pointerDown(handle, { clientX: 10 });
  fireEvent.pointerMove(document, { clientX: 60 });
  expect(onCommit).not.toHaveBeenCalled();
  fireEvent.pointerUp(document, { clientX: 60 });
  expect(onCommit).toHaveBeenCalledExactlyOnceWith({ service: 150, cost: 100 });
  fireEvent.pointerDown(handle, { clientX: 10 });
  fireEvent.pointerMove(document, { clientX: 30 });
  fireEvent.pointerCancel(document);
  fireEvent.pointerUp(document, { clientX: 30 });
  expect(onCommit).toHaveBeenCalledOnce();
  expect(document.body.style.cursor).toBe("");
  vi.unstubAllGlobals();

});

it("restores natural widths after undo and preserves other constraints during keyboard resizing", () => {
  vi.spyOn(HTMLElement.prototype,"offsetWidth","get").mockImplementation(function(this:HTMLElement){return this.tagName==='TABLE'?800:Number.parseFloat(this.style.width)||100;});
  vi.spyOn(HTMLElement.prototype,"getBoundingClientRect").mockReturnValue({width:50} as DOMRect);
  const options=props();const resizing={handleLabel:(label:string)=>`Resize ${label}`,savedWidths:{service:160,cost:200}};
  const view=render(<DataTable {...options} resizing={resizing} renderActions={()=>'Open'}/>);
  const headers=screen.getAllByRole('columnheader');
  fireEvent.keyDown(screen.getByRole('button',{name:'Resize Service'}),{key:'ArrowRight'});
  expect(headers[0]?.style.width).toBe('170px');expect(headers[1]?.style.width).toBe('200px');
  expect(headers[0]?.dataset.sticky).toBe('true');expect(headers[1]?.dataset.sticky).toBeUndefined();
  view.rerender(<DataTable {...options} resizing={{...resizing,savedWidths:{cost:200}}} renderActions={()=>'Open'}/>);
  expect(headers[0]?.style.width).toBe('100px');expect(headers[1]?.style.width).toBe('200px');
});
it("rolls back interrupted pointer styles and leaves the filling column flexible on release", () => {
  class TestPointerEvent extends MouseEvent {pointerId:number;constructor(type:string,init:PointerEventInit={}){super(type,init);this.pointerId=init.pointerId??1;}}
  vi.stubGlobal('PointerEvent',TestPointerEvent);
  vi.spyOn(HTMLElement.prototype,'offsetWidth','get').mockImplementation(function(this:HTMLElement){return this.tagName==='TABLE'?800:Number.parseFloat(this.style.width)||100;});
  const save=vi.fn();render(<DataTable {...props()} resizing={{handleLabel:label=>`Resize ${label}`,editable:true,onCommit:save}}/>);
  const handle=screen.getByRole('button',{name:'Resize Service'});const headers=screen.getAllByRole('columnheader');
  fireEvent.pointerDown(handle,{clientX:0,pointerId:7});fireEvent.pointerMove(document,{clientX:50,pointerId:7});
  expect(headers[0]?.style.width).toBe('150px');
  fireEvent.pointerCancel(document,{pointerId:8});expect(headers[0]?.style.width).toBe('150px');
  fireEvent.pointerCancel(document,{pointerId:7});expect(headers[0]?.style.width).toBe('100px');expect(save).not.toHaveBeenCalled();
  fireEvent.pointerDown(handle,{clientX:0,pointerId:7});fireEvent.pointerUp(document,{clientX:50,pointerId:7});
  expect(headers[0]?.style.width).toBe('150px');expect(headers[2]?.style.width).toBe('');expect(save).toHaveBeenCalledOnce();
});
it("supports primary row navigation and keyboard-accessible secondary actions", () => {
  const options = props();
  const view = render(
    <DataTable
      {...options}
      striped
      rowActions={() => [
        {
          action: {
            method: "goto",
            name: "View cost",
            link: "",
            target: "_blank",
          },
          href: "https://example.com/cost",
        },
        {
          action: {
            method: "goto",
            name: "History",
            link: "",
            target: "_self",
          },
          href: "#history",
        },
        {
          action: { method: "goto", name: "Unsafe", link: "", target: "_self" },
          href: "javascript:alert(1)",
        },
      ]}
    />,
  );
  const primary = screen.getByRole("link", { name: "View cost" });
  expect(primary.getAttribute("rel")).toBe("noopener noreferrer");
  const navigate = vi.fn((event: Event) => event.preventDefault());
  primary.addEventListener("click", navigate);
  fireEvent.click(screen.getByRole("cell", { name: "-2" }));
  expect(navigate).toHaveBeenCalledOnce();
  fireEvent.click(screen.getByRole("button", { name: "Actions" }));
  expect(navigate).toHaveBeenCalledOnce();
  expect(screen.getByRole("link", { name: "History" })).toBeTruthy();
  expect(screen.queryByRole("link", { name: "Unsafe" })).toBeNull();
  fireEvent.keyDown(document, { key: "Escape" });
  fireEvent.contextMenu(primary, { clientX: 12, clientY: 20 });
  expect(screen.getByRole("dialog", { name: "Actions" })).toBeTruthy();
  view.rerender(<DataTable {...options} rows={[]} />);
  expect(screen.queryByRole("dialog")).toBeNull();
});
it("never promotes a secondary action when the primary URL is unsafe", () => {
  render(
    <DataTable
      {...props()}
      rowActions={() => [
        {
          action: { method: "goto", name: "Unsafe", link: "", target: "_self" },
          href: "javascript:alert(1)",
        },
        {
          action: {
            method: "goto",
            name: "Secondary",
            link: "",
            target: "_self",
          },
          href: "#secondary",
        },
      ]}
    />,
  );
  expect(screen.queryByRole("link")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Actions" }));
  expect(screen.getByRole("link", { name: "Secondary" })).toBeTruthy();
});
it("keeps stripes available for unsupported colors and omits primary-only action columns", () => {
 const options=props();
 const action={action:{method:"goto" as const,name:"Primary",link:"",target:"_self" as const},href:"#details"};
 const view=render(<DataTable {...options} striped rowColor={()=>"url(secret)"} rowActions={()=>[action]}/>);
 expect(screen.getAllByRole("columnheader")).toHaveLength(options.columns.length);
 expect(screen.getAllByRole("row")[1]?.hasAttribute("data-row-color")).toBe(false);
 view.rerender(<DataTable {...options} rowActions={()=>[action,{...action,href:"#secondary"}]}/>);
 expect(screen.getAllByRole("columnheader")).toHaveLength(options.columns.length+1);
 view.rerender(<DataTable {...options} rowActions={()=>[action,{...action,href:"javascript:alert(1)"}]}/>);
 expect(screen.getAllByRole("columnheader")).toHaveLength(options.columns.length);
});
