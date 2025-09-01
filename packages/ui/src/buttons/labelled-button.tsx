"use client";
import { useState, useRef, useLayoutEffect } from "react";
import { Button } from "flowbite-react";

type LabelledButtonType = {
    label: string;
    children?: React.ReactNode;
    open_to_left?: boolean;
    onClick?: () => void;
    hover_disabled?: boolean;
    disable_label_after_click?: boolean;
};

export default function LabelledButton({
    label,
    children,
    open_to_left = false,
    onClick,
    hover_disabled = false,
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
                    if (disable_label_after_click) {
                        set_expanded(false);
                    } else if (!hover_disabled) {
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
                className="cursor-pointer bg-slate-0 p-0 w-10 h-10 bg-slate-0 text-slate-700 hover:bg-slate-200 font-medium rounded-full text-sm dark:bg-slate-900 dark:hover:bg-slate-800 focus:outline-none flex flex-row justify-center items-center border border-slate-700 dark:border-slate-200 transition-all duration-100 active:ring-2 active:ring-slate-300 active:dark:ring-slate-700"
            >
                <div className="text-slate-700 dark:text-slate-300">
                    {children}
                </div>
            </button>

            {/* Animated label container: only width + opacity (no padding jump) */}
            <div
                className={`flex items-center overflow-hidden transition-all ease-in-out duration-200 ${ expanded ? 'max-w-[200px]' : 'max-w-0' }`}
            >
                <span
                    ref={labelRef}
                    className={`px-5 text-slate-800 dark:text-white text-[14px] flex items-center transition-opacity duration-200 whitespace-nowrap `}
                    style={{ pointerEvents: "none" }}
                >
                    {label}
                </span>
            </div>
        </div>
    );
}
