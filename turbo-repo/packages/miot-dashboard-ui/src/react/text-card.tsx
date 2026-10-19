"use client";

export interface TextCardProps {
  text: string;
  italic?: boolean;
  align?: "left" | "center" | "right";
}

/** Presentational text card. Text is rendered as text, never interpreted as HTML. */
export function TextCard({
  text,
  italic = true,
  align = "left",
}: Readonly<TextCardProps>) {
  const alignment = align === "center" || align === "right" ? align : "left";
  return (
    <div className="miot-text-card">
      <p
        className="miot-text-card__text"
        data-align={alignment}
        data-italic={italic}
      >
        {text}
      </p>
    </div>
  );
}
