"use client";
import { useId, useState, type CSSProperties, type ReactNode } from "react";
export interface SensitiveStatProps {
  readonly title: string;
  readonly value: string;
  readonly sensitive?: boolean;
  /** Change when switching document, tenant or session. */
  readonly resetKey?: string;
  readonly showLabel: string;
  readonly hideLabel: string;
  readonly hint?: string;
  readonly showIcon?: ReactNode;
  readonly hideIcon?: ReactNode;
  readonly valueClassName?: string;
  readonly valueStyle?: CSSProperties;
}
/** Visual masking only; authorization belongs to the server. */
export function SensitiveStat(props: SensitiveStatProps) {
  const key = JSON.stringify([
    props.resetKey,
    props.title,
    props.value,
    props.sensitive,
  ]);
  return <SensitiveStatContent key={key} {...props} />;
}
function SensitiveStatContent({
  title,
  value,
  sensitive = true,
  showLabel,
  hideLabel,
  hint,
  showIcon,
  hideIcon,
  valueClassName = "",
  valueStyle,
}: SensitiveStatProps) {
  const id = useId();
  const [hidden, setHidden] = useState(sensitive);
  const label = hidden ? showLabel : hideLabel;
  const icon = hidden ? showIcon : hideIcon;
  return (
    <article className="miot-sensitive-stat" aria-label={title || undefined}>
      <header>
        <p>{title}</p>
        <button
          type="button"
          className="no-drag"
          aria-label={label}
          aria-controls={id}
          aria-expanded={!hidden}
          onClick={() => setHidden(!hidden)}
        >
          {icon ? <span aria-hidden="true">{icon}</span> : label}
        </button>
      </header>
      <p
        id={id}
        className={`miot-sensitive-stat__value ${hidden ? "" : valueClassName}`}
        data-hidden={hidden || undefined}
        style={hidden ? undefined : valueStyle}
      >
        {hidden ? "••••••" : value}
      </p>
      {hidden && hint && <p className="miot-sensitive-stat__hint">{hint}</p>}
    </article>
  );
}
