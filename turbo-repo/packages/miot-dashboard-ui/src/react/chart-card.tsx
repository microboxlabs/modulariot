"use client";

import { useEffect, useRef, type ReactNode } from "react";

export interface ChartCardProps {
  title?: string;
  toolbar?: ReactNode;
  children: ReactNode;
  /** Layout pixels, unaffected by a dashboard's CSS transform scale. */
  onResize?: (width: number, height: number) => void;
}

/** Engine-independent chart container. The host owns chart creation and disposal. */
export function ChartCard({
  title,
  toolbar,
  children,
  onResize,
}: Readonly<ChartCardProps>) {
  const containerRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const element = containerRef.current;
    if (!element || !onResize) return;
    let active = true;
    const measure = () => {
      if (active) onResize(element.clientWidth, element.clientHeight);
    };
    measure();
    const hostWindow = element.ownerDocument.defaultView;
    const observer = globalThis.ResizeObserver
      ? new ResizeObserver(measure)
      : undefined;
    if (observer) observer.observe(element);
    else hostWindow?.addEventListener("resize", measure);
    return () => {
      active = false;
      observer?.disconnect();
      hostWindow?.removeEventListener("resize", measure);
    };
  }, [onResize]);

  return (
    <article
      ref={containerRef}
      className="miot-chart-card"
      aria-label={title || undefined}
    >
      {title && <h3>{title}</h3>}
      {toolbar && <div className="miot-chart-card__toolbar">{toolbar}</div>}
      <div className="miot-chart-card__plot">{children}</div>
    </article>
  );
}
