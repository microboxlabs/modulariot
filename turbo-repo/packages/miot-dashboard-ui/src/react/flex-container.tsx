"use client";

import { Children, type ReactNode } from "react";

export type FlexLayout = "row" | "column" | "grid";
export interface FlexContainerProps {
  title: string;
  description?: ReactNode;
  layout?: FlexLayout;
  children?: ReactNode;
  emptyLabel: string;
  editMode?: boolean;
}

/** Responsive child layout with host-provided text and optional rich description. */
export function FlexContainer({
  title,
  description,
  layout = "row",
  children,
  emptyLabel,
  editMode = false,
}: Readonly<FlexContainerProps>) {
  const items = Children.toArray(children);
  const direction = layout === "column" || layout === "grid" ? layout : "row";
  return (
    <div className="miot-flex-container">
      <div className="miot-flex-container__header">
        <h3 className="miot-flex-container__title">{title}</h3>
        {description && (
          <div className="miot-flex-container__description">{description}</div>
        )}
      </div>
      <div className="miot-flex-container__body">
        {items.length === 0 && !editMode ? (
          <div className="miot-flex-container__empty">{emptyLabel}</div>
        ) : (
          <div className="miot-flex-container__items" data-layout={direction}>
            {Children.map(items, (child) => (
              <div className="miot-flex-container__item">{child}</div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
