"use client";
import { useId, useState, type CSSProperties } from "react";
export interface ExpandableStatProps {
  readonly title: string;
  readonly value: string;
  readonly unit?: string;
  readonly details: readonly {
    readonly label: string;
    readonly value: string;
  }[];
  readonly showLabel: string;
  readonly hideLabel: string;
  readonly resetKey?: string;
  /** Six-digit RGB without #. Invalid values use theme defaults. */
  readonly valueColor?: string;
  readonly backgroundColor?: string;
}
function color(raw: string | undefined) {
  return raw && /^[\da-f]{6}$/i.test(raw) ? `#${raw}` : undefined;
}
export function ExpandableStat(props: ExpandableStatProps) {
  return <ExpandableStatContent key={props.resetKey} {...props} />;
}
function ExpandableStatContent({
  title,
  value,
  unit,
  details,
  showLabel,
  hideLabel,
  valueColor,
  backgroundColor,
}: ExpandableStatProps) {
  const [expanded, setExpanded] = useState(false);
  const id = useId();
  const foreground = color(valueColor),
    background = color(backgroundColor);
  const style = background
    ? ({
        "--miot-expand-background": `${background}20`,
        "--miot-expand-detail": `${background}10`,
        "--miot-expand-hover": `${background}30`,
        "--miot-expand-control": background,
      } as CSSProperties)
    : undefined;
  return (
    <article
      className="miot-expandable-stat"
      aria-label={title || undefined}
      style={style}
    >
      <div className="miot-expandable-stat__main">
        <p>{title}</p>
        <strong style={{ color: foreground }}>
          {value}
          {unit && <span>{unit}</span>}
        </strong>
      </div>
      <button
        type="button"
        className="no-drag"
        aria-expanded={expanded}
        aria-controls={id}
        onClick={() => setExpanded(!expanded)}
      >
        {expanded ? hideLabel : showLabel}
        <span aria-hidden="true">{expanded ? "⌃" : "⌄"}</span>
      </button>
      {expanded && (
        <dl id={id} className="miot-expandable-stat__details">
          {details.map((detail, index) => (
            <div key={index}>
              <dt>{detail.label}</dt>
              <dd>{detail.value}</dd>
            </div>
          ))}
        </dl>
      )}
    </article>
  );
}
