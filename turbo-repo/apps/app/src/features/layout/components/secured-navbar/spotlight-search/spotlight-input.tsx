"use client";

import {
  useLayoutEffect,
  useRef,
  useState,
  useEffect,
  type ComponentType,
} from "react";

interface SpotlightInputProps {
  query: string;
  onChange: (value: string) => void;
  placeholder: string;
  ModeIcon: ComponentType<{ className?: string }>;
  iconColor: string;
  iconBg: string;
  showOpenChat: boolean;
  onOpenChat: () => void;
}

export function SpotlightInput({
  query,
  onChange,
  placeholder,
  ModeIcon,
  iconColor,
  iconBg,
  showOpenChat,
  onOpenChat,
}: Readonly<SpotlightInputProps>) {
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus the input when the panel opens.
  useLayoutEffect(() => {
    const id = setTimeout(() => inputRef.current?.focus(), 60);
    return () => clearTimeout(id);
  }, []);

  // Scale-out → swap → scale-in when the icon component changes.
  const prevModeIcon = useRef(ModeIcon);
  const [iconVisible, setIconVisible] = useState(true);
  useEffect(() => {
    if (ModeIcon === prevModeIcon.current) return;
    prevModeIcon.current = ModeIcon;
    setIconVisible(false);
    const id = setTimeout(() => setIconVisible(true), 120);
    return () => clearTimeout(id);
  }, [ModeIcon]);

  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <div
        className={`
          flex h-8 w-8 shrink-0 items-center justify-center rounded-lg
          ring-1 ring-inset ring-black/6 dark:ring-white/10
          transition-colors duration-300 ease-in-out
          ${iconBg}
        `}
      >
        <span
          className={`inline-flex transition-transform duration-150 ease-in-out ${
            iconVisible ? "scale-100 rotate-0" : "scale-0 rotate-90"
          }`}
        >
          <ModeIcon className={`h-4 w-4 ${iconColor}`} />
        </span>
      </div>

      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        spellCheck={false}
        autoComplete="off"
        className="flex-1 bg-transparent text-base text-gray-900 placeholder:text-gray-400 outline-none dark:text-gray-100 dark:placeholder:text-gray-500"
      />

      {showOpenChat && (
        <button
          type="button"
          onClick={onOpenChat}
          className="flex shrink-0 items-center gap-1 rounded-md border border-gray-200 bg-gray-50 px-2 py-1 text-[11px] font-medium text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-400 dark:hover:bg-gray-600 dark:hover:text-gray-200"
        >
          <kbd className="font-mono text-[10px]">⌘</kbd>
          <kbd className="font-mono text-[10px]">↵</kbd>
          Open chat
        </button>
      )}
    </div>
  );
}
