"use client";

import { useId, type ComponentType, type ReactNode } from "react";
import type { Widget } from "@microboxlabs/miot-dashboard-contract/document";

export type WidgetAction = "add" | "settings" | "duplicate" | "delete";
export interface WidgetComponentProps {
  widget: Widget;
  editMode: boolean;
  isRoot?: boolean;
  onAddChild?: (componentId: string) => void;
  onOpenSettings?: () => void;
  onDelete?: () => void;
  children?: ReactNode;
}
export interface RenderableWidget {
  meta: { hasChildren: boolean; hasSettings: boolean };
  Component: ComponentType<WidgetComponentProps>;
}
export interface WidgetFrameProps {
  widget: Widget;
  definition: RenderableWidget | undefined;
  editMode: boolean;
  onAction: (action: WidgetAction) => void;
  children: ReactNode;
}
export interface WidgetRendererProps {
  widget: Widget;
  registry: { get(id: string): RenderableWidget | undefined };
  /** Host must derive this from authorized edit capabilities. Defaults to false. */
  editMode?: boolean;
  isRoot?: boolean;
  onAction?: (widget: Widget, action: WidgetAction) => void;
  Frame?: ComponentType<WidgetFrameProps>;
  /** Localized fallback text for unavailable widget implementations. */
  unknownWidgetLabel: string;
  /** Optional host anchor compatibility. Must be unique across mounted instances. */
  widgetDomId?: (widget: Widget) => string;
}

function PlainFrame({ children }: Readonly<WidgetFrameProps>) {
  return <>{children}</>;
}

export function WidgetRenderer(props: Readonly<WidgetRendererProps>) {
  const instance = useId();
  return <WidgetNode {...props} instance={instance} />;
}

function WidgetNode({
  widget,
  registry,
  editMode = false,
  isRoot = false,
  onAction,
  Frame = PlainFrame,
  unknownWidgetLabel,
  widgetDomId,
  instance,
}: Readonly<WidgetRendererProps & { instance: string }>) {
  const definition = registry.get(widget.componentId);
  const editable = editMode && !!onAction;
  const act = (action: WidgetAction) => {
    if (!editable) return;
    if (action === "add" && !definition?.meta.hasChildren) return;
    if (action === "settings" && !definition?.meta.hasSettings) return;
    onAction?.(widget, action);
  };
  const Component = definition?.Component;
  const children = widget.children?.map((child) => (
    <div key={child.id} className="h-full">
      <WidgetNode
        widget={child}
        registry={registry}
        editMode={editable}
        onAction={onAction}
        Frame={Frame}
        unknownWidgetLabel={unknownWidgetLabel}
        widgetDomId={widgetDomId}
        instance={instance}
      />
    </div>
  ));
  return (
    <div
      id={widgetDomId?.(widget) ?? `${instance}-widget-${widget.id}`}
      className="widget-wrapper relative h-full"
    >
      <Frame
        widget={widget}
        definition={definition}
        editMode={editable}
        onAction={act}
      >
        {Component ? (
          <Component
            widget={widget}
            editMode={editable}
            isRoot={isRoot}
            onAddChild={
              editable && definition.meta.hasChildren
                ? () => act("add")
                : undefined
            }
            onOpenSettings={
              editable && definition.meta.hasSettings
                ? () => act("settings")
                : undefined
            }
            onDelete={editable ? () => act("delete") : undefined}
          >
            {children}
          </Component>
        ) : (
          <span>
            {unknownWidgetLabel} ({widget.componentId})
          </span>
        )}
      </Frame>
    </div>
  );
}
