"use client";

import { useRef, useState, type FC } from "react";
import { type ToolCallMessagePartProps } from "@assistant-ui/react";
import { Checkbox, Radio } from "flowbite-react";
import { twMerge } from "tailwind-merge";
import type { AskUserQuestionArgs, AskUserQuestionResult } from "../ask-user-question";
import { useHarnessChatTr } from "../../context/harness-chat-i18n-context";

const OTHER_VALUE = "__other__";

const optionRowClass =
  "flex cursor-pointer items-center gap-2 rounded-md px-2 py-1 text-xs text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-700";

const OptionSelector: FC<{
  multiSelect: boolean;
  checked: boolean;
  onChange: () => void;
  value?: string;
  ariaLabel?: string;
}> = ({ multiSelect, checked, onChange, value, ariaLabel }) =>
  multiSelect ? (
    <Checkbox
      checked={checked}
      onChange={onChange}
      aria-label={ariaLabel}
      className="shrink-0"
    />
  ) : (
    <Radio
      name="ask-user-question"
      value={value}
      checked={checked}
      onChange={onChange}
      aria-label={ariaLabel}
      className="shrink-0"
    />
  );

export const AskUserQuestionCard: FC<
  ToolCallMessagePartProps<AskUserQuestionArgs, AskUserQuestionResult>
> = ({ args, result, isError, addResult }) => {
  const tr = useHarnessChatTr();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [otherSelected, setOtherSelected] = useState(false);
  const [otherText, setOtherText] = useState("");
  const otherInputRef = useRef<HTMLInputElement>(null);

  // A pending question left unanswered when a newer message supersedes it
  // gets auto-cancelled by the runtime — `result` is then an error payload
  // (e.g. `{ error: "Tool call cancelled by user" }`), not our own
  // AskUserQuestionResult shape. `isError` is the documented way to tell
  // the two apart; checking `result.selected` directly would throw here.
  if (isError) {
    return (
      <div className="w-full rounded-lg border border-gray-200 bg-white p-3 text-xs dark:border-gray-700 dark:bg-gray-800">
        <p className="font-medium text-gray-700 dark:text-gray-200">{args.question}</p>
        <p className="mt-1 italic text-gray-400 dark:text-gray-500">
          {tr("harnessChat.ui.askUserQuestion.skipped")}
        </p>
      </div>
    );
  }

  if (result) {
    const answer = [...result.selected, result.other].filter(Boolean).join(", ");
    return (
      <div className="w-full rounded-lg border border-gray-200 bg-white p-3 text-xs dark:border-gray-700 dark:bg-gray-800">
        <p className="font-medium text-gray-700 dark:text-gray-200">{args.question}</p>
        <p className="mt-1 text-gray-500 dark:text-gray-400">
          {answer || tr("harnessChat.ui.askUserQuestion.noAnswer")}
        </p>
      </div>
    );
  }

  const toggle = (label: string) => {
    setSelected((prev) => {
      const next = new Set(args.allowMultiple ? prev : []);
      if (args.allowMultiple && prev.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
    if (!args.allowMultiple) setOtherSelected(false);
  };

  const selectOther = () => {
    const next = args.allowMultiple ? !otherSelected : true;
    setOtherSelected(next);
    if (!args.allowMultiple) setSelected(new Set());
    if (next) otherInputRef.current?.focus();
  };

  const submit = () => {
    addResult({
      selected: [...selected],
      other: otherSelected ? otherText.trim() || undefined : undefined,
    });
  };

  const canSubmit =
    selected.size > 0 || (otherSelected && otherText.trim().length > 0);

  return (
    <div className="flex w-full flex-col gap-2 rounded-lg border border-gray-200 bg-white p-3 text-xs dark:border-gray-700 dark:bg-gray-800">
      <div>
        <p className="font-medium text-gray-700 dark:text-gray-200">{args.question}</p>
        {args.description && (
          <p className="mt-0.5 text-gray-400 dark:text-gray-500">{args.description}</p>
        )}
      </div>

      <div className="flex flex-col gap-0.5">
        {args.options.map((option) => (
          <label key={option.label} className={optionRowClass}>
            <OptionSelector
              multiSelect={!!args.allowMultiple}
              checked={selected.has(option.label)}
              onChange={() => toggle(option.label)}
            />
            <span className="flex flex-col">
              <span>{option.label}</span>
              {option.description && (
                <span className="text-[10px] text-gray-400 dark:text-gray-500">
                  {option.description}
                </span>
              )}
            </span>
          </label>
        ))}

        {args.allowOther && (
          <label className={optionRowClass}>
            <OptionSelector
              multiSelect={!!args.allowMultiple}
              checked={otherSelected}
              onChange={selectOther}
              value={OTHER_VALUE}
              ariaLabel={tr("harnessChat.ui.askUserQuestion.otherAriaLabel")}
            />
            <input
              ref={otherInputRef}
              type="text"
              placeholder={tr("harnessChat.ui.askUserQuestion.otherPlaceholder")}
              value={otherText}
              readOnly={!otherSelected}
              onFocus={() => {
                if (!otherSelected) selectOther();
              }}
              onChange={(e) => setOtherText(e.target.value)}
              className={twMerge(
                "flex-1 rounded-md border border-gray-200 bg-transparent px-2 py-1 text-xs text-gray-800 outline-none placeholder:text-gray-400 dark:border-gray-600 dark:text-gray-100 dark:placeholder:text-gray-500",
                otherSelected ? "cursor-text" : "cursor-pointer opacity-60"
              )}
            />
          </label>
        )}
      </div>

      <button
        type="button"
        onClick={submit}
        disabled={!canSubmit}
        className={twMerge(
          "self-end rounded-md bg-gray-800 px-2.5 py-1 text-xs text-white hover:bg-gray-700 disabled:pointer-events-none disabled:opacity-40",
          "dark:bg-gray-200 dark:text-gray-900 dark:hover:bg-gray-300"
        )}
      >
        {tr("harnessChat.ui.askUserQuestion.submit")}
      </button>
    </div>
  );
};
