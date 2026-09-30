// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { SettingsPanel } from "./settings-panel";
afterEach(cleanup);
const tabs = [{id:"view",label:"Visualization",content:<input aria-label="Title"/>},{id:"data",label:"Data",content:<p>Connection binding</p>}];
it("navigates tabs by keyboard and recovers a removed tab", () => {
  const props={tabsLabel:"Widget settings",saveLabel:"Save",onSave:vi.fn(),isDirty:true};
  const view=render(<SettingsPanel {...props} tabs={tabs}/>);
  const first=screen.getByRole("tab",{name:"Visualization"});
  first.focus();fireEvent.keyDown(first,{key:"ArrowRight"});
  const data=screen.getByRole("tab",{name:"Data"});
  expect(document.activeElement).toBe(data);
  expect(data.getAttribute("aria-selected")).toBe("true");
  expect(screen.getByRole("tabpanel").id).toBe(data.getAttribute("aria-controls"));
  view.rerender(<SettingsPanel {...props} tabs={[tabs[0]!]}/>);
  expect(screen.getByRole("tab").getAttribute("aria-selected")).toBe("true");
  expect(screen.getByRole("textbox",{name:"Title"})).toBeTruthy();
});
it("isolates tab ids and only saves dirty enabled settings", () => {
  const save=vi.fn();
  const props={tabsLabel:"Settings",saveLabel:"Save",onSave:save,isDirty:false};
  const view=render(<SettingsPanel {...props}>Single pane</SettingsPanel>);
  fireEvent.click(screen.getByRole("button",{name:"Save"}));expect(save).not.toHaveBeenCalled();
  view.rerender(<SettingsPanel {...props} isDirty disabled/>);
  fireEvent.click(screen.getByRole("button",{name:"Save"}));expect(save).not.toHaveBeenCalled();
  view.rerender(<SettingsPanel {...props} isDirty/>);
  fireEvent.click(screen.getByRole("button",{name:"Save"}));expect(save).toHaveBeenCalledOnce();
  view.rerender(<><SettingsPanel {...props} tabs={tabs}/><SettingsPanel {...props} tabs={tabs}/></>);
  const ids=screen.getAllByRole("tab").map(tab=>tab.id);expect(new Set(ids).size).toBe(ids.length);
});
