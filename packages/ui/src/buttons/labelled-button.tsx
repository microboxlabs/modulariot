"use client";
import { useState, useRef, useLayoutEffect } from "react";
import { Button } from "flowbite-react";

type LabelledButtonType = {
    label: string;
    children?: React.ReactNode;
    open_to_left?: boolean;
    onClick?: () => void;
    hover_disabled?: boolean;
    border?: string;
    disable_label_after_click?: boolean;
};

export default function LabelledButton({
    label,
    children,
    open_to_left = false,
    onClick,
    hover_disabled = false,
    border = "",
    disable_label_after_click = false,
}: LabelledButtonType) {
    const [expanded, set_expanded] = useState(false);
    const labelRef = useRef<HTMLSpanElement | null>(null);
    const [labelWidth, setLabelWidth] = useState(0);

    // Measure natural width of the label text (including padding inside span)
    useLayoutEffect(() => {
        if (labelRef.current) {
            setLabelWidth(labelRef.current.scrollWidth);
        }
    }, [label]);

    return (
        <div
            className={`flex h-10 z-10 ${
                open_to_left ? "flex-row-reverse justify-self-end" : "flex-row"
            } transition-all duration-300 rounded-full w-fit bg-white dark:bg-slate-800`}
        >
            <button 
                type="button"
                onClick={() => {
                    if (!hover_disabled && !disable_label_after_click) {
                        set_expanded(false);
                    }
                    onClick?.();
                }}
                onMouseEnter={() => {
                    if (!hover_disabled) {
                        set_expanded(true);
                    }
                }}
                onMouseLeave={() => {
                    set_expanded(false);
                }}
                className="bg-slate-0  text-slate-700 hover:bg-slate-300 focus:ring-4 focus:ring-slate-300 font-medium rounded-full text-sm p-0 dark:bg-slate-700 dark:hover:bg-slate-600 focus:outline-none dark:focus:ring-slate-800 w-10 h-10 flex justify-center items-center border border-slate-700 dark:border-slate-200 transition-colors duration-200"
            >
                <div className="text-slate-700 dark:text-slate-300">
                    {children}
                </div>
            </button>

            {/* Animated label container: only width + opacity (no padding jump) */}
            <div
                className="flex items-center overflow-hidden transition-[width] duration-300"
                style={{ width: expanded ? labelWidth : 0 }}
            >
                <span
                    ref={labelRef}
                    className={`px-5 text-slate-800 dark:text-white text-[14px] flex items-center transition-opacity duration-200 ${
                        expanded ? "opacity-100" : "opacity-0"
                    }`}
                    style={{ pointerEvents: "none" }}
                >
                    {label}
                </span>
            </div>
        </div>
    );
}
