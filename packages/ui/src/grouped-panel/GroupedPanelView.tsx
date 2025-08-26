import React, { useState, useId, type ReactElement } from 'react';
import { PanelItem, type PanelItemProps } from './PanelItem';
import { ButtonGroup } from "flowbite-react";

export interface GroupedPanelViewProps {
    children: React.ReactNode;
    defaultIndex?: number;
    className?: string;
    actionsClassName?: string;
    panelClassName?: string;
}

export const GroupedPanelView: React.FC<GroupedPanelViewProps> = ({
    children,
    defaultIndex = 0,
    className = '',
    actionsClassName = '',
    panelClassName = '',
}) => {
    const all = React.Children.toArray(children) as ReactElement[];
    const items = all.filter(
        (c) => React.isValidElement(c) && (c.type as any).displayName === PanelItem.displayName
    ) as ReactElement<PanelItemProps>[];

    const [active, setActive] = useState(
        Math.min(Math.max(defaultIndex, 0), items.length - 1)
    );

    const baseId = useId();

    return (
        <div className={`w-full ${className}`}>
            <div
                role="tablist"
                className={`flex flex-wrap gap-2 mb-2 ${actionsClassName}`}
                aria-label="panel selector"
            >
                <div className="inline-flex shadow-xs rounded-lg overflow-hidden" role="group">
                    {items.map((item, idx) => {
                    const { actionText, disabled } = item.props;
                        return (
                            <button
                                key={idx}
                                role="tab"
                                id={`${baseId}-tab-${idx}`}
                                aria-selected={active === idx}
                                aria-controls={`${baseId}-panel-${idx}`}
                                disabled={disabled}
                                onClick={() => {
                                    if (!disabled) setActive(idx);
                                }}
                                type="button"
                                className={`transition-all  font-medium text-sm px-5 py-2.5 focus:outline-none ${ active === idx ? "bg-slate-700 text-slate-200 dark:bg-slate-200 dark:text-slate-800" : "text-slate-800  bg-slate-200 hover:bg-slate-300 focus:ring-slate-300 dark:text-slate-200 dark:hover:text-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 dark:focus:ring-slate-300" } `}
                            >
                                {actionText}
                            </button>
                        );
                    })}
                </div>
            </div>
            <div className={`rounded ${panelClassName}`}>
                {items.map((item, idx) =>
                idx === active ? (
                    <div
                    key={idx}
                    role="tabpanel"
                    id={`${baseId}-panel-${idx}`}
                    aria-labelledby={`${baseId}-tab-${idx}`}
                    className="h-full w-full"
                    >
                    {item.props.children}
                    </div>
                ) : null
                )}
            </div>
        </div>
    );
};

GroupedPanelView.displayName = 'GroupedPanelView';