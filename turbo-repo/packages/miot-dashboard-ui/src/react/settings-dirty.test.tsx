// @vitest-environment jsdom
import { useEffect, useState, StrictMode } from "react";
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { useSettingsDirty } from "./use-settings-dirty";
import { DirtySettingsProvider, useDirtySettings } from "./dirty-settings-context";
afterEach(cleanup);
it("settles form resets on opening and tracks edits against the new baseline", () => {
  const {result,rerender}=renderHook(({open,initial})=>{
    const [title,setTitle]=useState(initial);
    useEffect(()=>{if(open)setTitle(initial);},[open,initial]);
    return {dirty:useSettingsDirty(open,{title}),setTitle};
  },{initialProps:{open:false,initial:"First"},wrapper:StrictMode});
  rerender({open:true,initial:"First"});expect(result.current.dirty).toBe(false);
  act(()=>result.current.setTitle("Changed"));expect(result.current.dirty).toBe(true);
  act(()=>result.current.setTitle("First"));expect(result.current.dirty).toBe(false);
  rerender({open:false,initial:"Second"});expect(result.current.dirty).toBe(false);
  rerender({open:true,initial:"Second"});expect(result.current.dirty).toBe(false);
  act(()=>result.current.setTitle("Next edit"));expect(result.current.dirty).toBe(true);
});
it("isolates providers, updates the save callback and clears a removed form handler", () => {
  const one=renderHook(useDirtySettings,{wrapper:DirtySettingsProvider});
  const two=renderHook(useDirtySettings,{wrapper:DirtySettingsProvider});
  const old=vi.fn(),current=vi.fn();
  act(()=>{one.result.current.registerDirty(true);one.result.current.registerSaveAndClose(old);});
  expect(one.result.current.isDirty).toBe(true);expect(two.result.current.isDirty).toBe(false);
  const stable=one.result.current.onSaveAndClose;
  act(()=>one.result.current.registerSaveAndClose(current));
  stable?.();expect(current).toHaveBeenCalledOnce();expect(old).not.toHaveBeenCalled();
  act(()=>one.result.current.registerSaveAndClose(undefined));
  expect(one.result.current.onSaveAndClose).toBeUndefined();stable?.();expect(current).toHaveBeenCalledOnce();
});
