"use client";
import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent,
} from "react";
import type { DataTableProps } from "./data-table";
import { TableCellValue } from "./table-cell";
import { ActionDropdown } from "./action-dropdown";
import { RowContextMenu, type ResolvedContextItem } from "./row-context-menu";
import { isSafeActionUrl } from "../core/action-helpers";

type RowProps = Pick<
  DataTableProps,
  "columns" | "resolveValue" | "resolveType" | "renderActions" | "actionsLabel"
> & {
  readonly row: Record<string, string>;
  readonly index: number;
  readonly count: number;
  readonly color?: string | null;
  readonly position: (index: number) => CSSProperties;
  readonly hasActions: boolean;
  readonly actions: readonly ResolvedContextItem[];
};
export function usableRowAction(
  item: ResolvedContextItem | undefined,
): item is ResolvedContextItem {
  return Boolean(
    item?.action.method === "goto" &&
    (item.action.target === "_self" || item.action.target === "_blank") &&
    isSafeActionUrl(item.href),
  );
}
function rowStyle(color: string | null | undefined): CSSProperties | undefined {
  if (!color || !/^#?(?:[\da-f]{3}|[\da-f]{6})$/i.test(color)) return undefined;
  const hex = color.startsWith("#") ? color : `#${color}`;
  return {
    "--miot-row-background": `color-mix(in srgb, ${hex} 12%, var(--miot-card-background, #fff))`,
  } as CSSProperties;
}
export function DataTableRow({
  columns,
  row,
  index,
  count,
  color,
  position,
  hasActions,
  actions,
  actionsLabel,
  resolveValue,
  resolveType,
  renderActions,
}: RowProps) {
  const primary = usableRowAction(actions[0]) ? actions[0] : undefined;
  const secondary = actions.slice(1).filter(usableRowAction);
  const primaryRef = useRef<HTMLAnchorElement>(null);
  const rowRef = useRef<HTMLTableRowElement>(null);
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  const actionSignature = JSON.stringify(actions);
  useEffect(() => setMenu(null), [row, actionSignature]);
  const navigate = (event: MouseEvent<HTMLTableRowElement>) => {
    if (!primary || event.defaultPrevented) return;
    const target = event.target as HTMLElement;
    if (
      target.closest(
        "a, button, input, select, textarea, [contenteditable=true]",
      )
    )
      return;
    const win = event.currentTarget.ownerDocument.defaultView;
    if (win?.getSelection()?.toString()) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey) {
      win?.open(primary.href, "_blank", "noopener,noreferrer");
    } else primaryRef.current?.click();
  };
  return (
    <>
      <tr
        ref={rowRef}
        data-row-color={color && (rowStyle(color) || ["red", "orange", "yellow", "green", "blue", "purple", "gray"].includes(color)) ? color : undefined}
        style={rowStyle(color)}
        data-navigable={Boolean(primary)}
        onClick={navigate}
        onContextMenu={(event) => {
          if (!secondary.length) return;
          event.preventDefault();
          setMenu({ x: event.clientX, y: event.clientY });
        }}
      >
        {columns.map((column, columnIndex) => {
          const content = (
            <>
              <TableCellValue
                value={resolveValue(column.key, row, index, count)}
                type={
                  resolveType?.(column.key, row, index, count) ?? column.type
                }
                colorMap={
                  column.colorRulesEnabled ? column.colorMap : undefined
                }
              />
              {column.decorator && (
                <span className="miot-data-table__decorator">
                  {column.decorator}
                </span>
              )}
            </>
          );
          return (
            <td key={column.key} style={position(columnIndex)}>
              {columnIndex === 0 && primary ? (
                <a
                  ref={primaryRef}
                  className="miot-data-table__row-link"
                  href={primary.href}
                  target={primary.action.target}
                  rel={
                    primary.action.target === "_blank"
                      ? "noopener noreferrer"
                      : undefined
                  }
                  aria-label={primary.action.name || undefined}
                >
                  {content}
                </a>
              ) : (
                content
              )}
            </td>
          );
        })}
        {hasActions && (
          <td className="miot-data-table__actions">
            {renderActions?.(row, index)}
            {secondary.length > 0 && (
              <ActionDropdown items={secondary} ariaLabel={actionsLabel} />
            )}
          </td>
        )}
      </tr>
      {menu && secondary.length > 0 && (
        <RowContextMenu
          items={secondary}
          {...menu}
          ariaLabel={actionsLabel}
          returnFocusTo={
            primaryRef.current ?? rowRef.current?.querySelector("button")
          }
          onClose={() => setMenu(null)}
        />
      )}
    </>
  );
}
