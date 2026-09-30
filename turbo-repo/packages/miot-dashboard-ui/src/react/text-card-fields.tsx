"use client";
import { useId } from "react";

export interface TextCardFieldValue {
  text: string;
  italic: boolean;
  align: "left" | "center" | "right";
}
export interface TextCardFieldsProps {
  value: Readonly<TextCardFieldValue>;
  onChange: (value: TextCardFieldValue) => void;
  labels: Readonly<
    Record<
      | "legend"
      | "text"
      | "placeholder"
      | "alignment"
      | "left"
      | "center"
      | "right"
      | "italic",
      string
    >
  >;
  disabled?: boolean;
  textStatus?: "none" | "valid" | "invalid";
  validationMessage?: string;
}
/** Controlled appearance fields; the host owns drafts, validation and apply/cancel. */
export function TextCardFields({
  value,
  onChange,
  labels,
  disabled = false,
  textStatus = "none",
  validationMessage,
}: Readonly<TextCardFieldsProps>) {
  const id = useId();
  const change = (patch: Partial<TextCardFieldValue>) => {
    if (!disabled) onChange({ ...value, ...patch });
  };
  return (
    <fieldset className="miot-text-card-fields" disabled={disabled}>
      <legend>{labels.legend}</legend>
      <label htmlFor={`${id}-text`}>{labels.text}</label>
      <textarea
        id={`${id}-text`}
        rows={4}
        value={value.text}
        placeholder={labels.placeholder}
        onChange={(event) => change({ text: event.target.value })}
        data-validation={textStatus}
        aria-invalid={textStatus === "invalid" || undefined}
        aria-describedby={validationMessage ? `${id}-validation` : undefined}
      />
      {validationMessage && <p id={`${id}-validation`}>{validationMessage}</p>}
      <label htmlFor={`${id}-align`}>{labels.alignment}</label>
      <select
        id={`${id}-align`}
        value={value.align}
        onChange={(event) => {
          const align = event.target.value;
          if (align === "left" || align === "center" || align === "right")
            change({ align });
        }}
      >
        <option value="left">{labels.left}</option>
        <option value="center">{labels.center}</option>
        <option value="right">{labels.right}</option>
      </select>
      <label
        className="miot-text-card-fields__checkbox"
        htmlFor={`${id}-italic`}
      >
        <input
          id={`${id}-italic`}
          type="checkbox"
          checked={value.italic}
          onChange={(event) => change({ italic: event.target.checked })}
        />
        {labels.italic}
      </label>
    </fieldset>
  );
}
