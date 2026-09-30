"use client";
import { useId, useRef, useState, type ReactNode } from "react";

export interface SettingsPanelTab {
  readonly id: string;
  readonly label: string;
  readonly content: ReactNode;
}
export interface SettingsPanelProps {
  readonly tabs?: readonly SettingsPanelTab[];
  readonly tabsLabel: string;
  readonly children?: ReactNode;
  readonly footer?: ReactNode;
  readonly saveLabel: string;
  readonly onSave: () => void;
  readonly isDirty: boolean;
  readonly disabled?: boolean;
  readonly contentClassName?: string;
}

/** Host-owned settings content; authority, persistence and dismissal stay with the host. */
export function SettingsPanel({
  tabs,
  tabsLabel,
  children,
  footer,
  saveLabel,
  onSave,
  isDirty,
  disabled = false,
  contentClassName = "",
}: SettingsPanelProps) {
  const id = useId();
  const [selected, setSelected] = useState(tabs?.[0]?.id);
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  const activeIndex = Math.max(
    0,
    tabs?.findIndex((tab) => tab.id === selected) ?? 0,
  );
  const active = tabs?.[activeIndex];
  function moveTab(key: string, index: number): boolean {
    if (!tabs?.length) return false;
    let next: number;
    switch (key) {
      case "ArrowRight":
        next = (index + 1) % tabs.length;
        break;
      case "ArrowLeft":
        next = (index + tabs.length - 1) % tabs.length;
        break;
      case "Home":
        next = 0;
        break;
      case "End":
        next = tabs.length - 1;
        break;
      default:
        return false;
    }
    setSelected(tabs[next]?.id);
    buttons.current[next]?.focus();
    return true;
  }
  return (
    <div
      className="miot-settings-panel"
      onPointerDown={(event) => event.stopPropagation()}
      onMouseDown={(event) => event.stopPropagation()}
    >
      {active && (
        <div
          role="tablist"
          aria-label={tabsLabel}
          className="miot-settings-panel__tabs"
        >
          {tabs?.map((tab, index) => (
            <button
              key={tab.id}
              ref={(element) => {
                buttons.current[index] = element;
              }}
              type="button"
              role="tab"
              id={`${id}-tab-${index}`}
              aria-controls={`${id}-panel-${index}`}
              aria-selected={index === activeIndex}
              tabIndex={index === activeIndex ? 0 : -1}
              onClick={() => setSelected(tab.id)}
              onKeyDown={(event) => {
                if (moveTab(event.key, index)) {
                  event.preventDefault();
                  event.stopPropagation();
                }
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      )}
      {active ? (
        <div
          role="tabpanel"
          id={`${id}-panel-${activeIndex}`}
          aria-labelledby={`${id}-tab-${activeIndex}`}
          tabIndex={0}
          className={`miot-settings-panel__content ${contentClassName}`}
        >
          {active.content}
        </div>
      ) : (
        <div className={`miot-settings-panel__content ${contentClassName}`}>
          {children}
        </div>
      )}
      <div className="miot-settings-panel__footer">
        {footer}
        <button type="button" disabled={!isDirty || disabled} onClick={onSave}>
          {saveLabel}
        </button>
      </div>
    </div>
  );
}
