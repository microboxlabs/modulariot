"use client";
import { useEffect, useRef } from "react";

export interface ChartEngine<Option> {
  /** Replace the previous options/data; do not retain series omitted by the new option. */
  update: (option: Option) => void;
  resize: () => void;
  dispose: () => void;
  hideTooltip?: () => void;
}
export interface ChartEngineViewProps<Option> {
  /** Keep factory identity stable. A new factory disposes and recreates the engine. */
  createEngine: (element: HTMLDivElement) => ChartEngine<Option>;
  option: Option;
  ariaLabel: string;
}

/** Host engine bridge with deterministic update and cleanup, including Strict Mode. */
export function ChartEngineView<Option>({
  createEngine,
  option,
  ariaLabel,
}: ChartEngineViewProps<Option>) {
  const elementRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<ChartEngine<Option> | null>(null);
  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;
    const engine = createEngine(element);
    engineRef.current = engine;
    let active = true;
    const resize = () => {
      if (active) engine.resize();
    };
    const hostWindow = element.ownerDocument.defaultView;
    const observer = globalThis.ResizeObserver
      ? new ResizeObserver(resize)
      : undefined;
    if (observer) observer.observe(element);
    else hostWindow?.addEventListener("resize", resize);
    return () => {
      active = false;
      observer?.disconnect();
      hostWindow?.removeEventListener("resize", resize);
      if (engineRef.current === engine) engineRef.current = null;
      engine.dispose();
    };
  }, [createEngine]);
  useEffect(() => {
    engineRef.current?.update(option);
  }, [createEngine, option]);
  return (
    <>
      <div
        ref={elementRef}
        className="miot-chart-engine"
        aria-hidden="true"
        onPointerLeave={() => engineRef.current?.hideTooltip?.()}
      />
      {ariaLabel && <span className="miot-sr-only">{ariaLabel}</span>}
    </>
  );
}
