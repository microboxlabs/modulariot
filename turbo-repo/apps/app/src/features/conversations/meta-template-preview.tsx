import { HiExternalLink, HiPhone, HiReply } from "react-icons/hi";
import type { MetaTemplateDraft } from "./conversations-types";
import { fillText } from "./rule-model";

function Filled({
  text,
  values,
}: Readonly<{ text: string; values: Record<string, string> }>) {
  const filled = Object.fromEntries(
    Object.entries(values).filter(([, v]) => v.trim() !== "")
  );
  return (
    <>
      {fillText(text, filled).map((p, i) => {
        const k = `${i}-${"text" in p ? p.text : p.variable}`;
        if ("text" in p) return <span key={k}>{p.text}</span>;
        return p.value === null ? (
          <span
            key={k}
            className="rounded bg-gray-200 px-1 font-mono text-xs text-gray-700 dark:bg-gray-600 dark:text-gray-200"
          >{`{{${p.variable}}}`}</span>
        ) : (
          <span key={k}>{p.value}</span>
        );
      })}
    </>
  );
}

// Meta has more button types (COPY_CODE, FLOW, OTP…); those show without an icon.
const BUTTON_ICON: Partial<Record<string, typeof HiReply>> = {
  QUICK_REPLY: HiReply,
  URL: HiExternalLink,
  PHONE_NUMBER: HiPhone,
};

/** The message as the recipient sees it in WhatsApp, with the examples in place of the parameters. */
export default function MetaTemplatePreview({
  draft,
  label,
}: Readonly<{ draft: MetaTemplateDraft; label: string }>) {
  return (
    <figure
      aria-label={label}
      className="rounded-lg bg-gray-100 p-4 dark:bg-gray-900"
    >
      <div className="max-w-sm">
        <div className="rounded-lg rounded-tl-none bg-white px-3 py-2 text-sm text-gray-900 shadow-sm dark:bg-gray-700 dark:text-gray-100">
          {draft.header.trim() && (
            <p className="mb-1 font-semibold">
              <Filled text={draft.header} values={draft.examples} />
            </p>
          )}
          <p className="whitespace-pre-wrap break-words">
            {draft.body.trim() ? (
              <Filled text={draft.body} values={draft.examples} />
            ) : (
              "—"
            )}
          </p>
          {draft.footer.trim() && (
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              {draft.footer}
            </p>
          )}
          <p className="mt-1 text-right text-[11px] text-gray-500 dark:text-gray-400">
            14:05
          </p>
        </div>
        {draft.buttons.map((b, i) => {
          const Icon = BUTTON_ICON[b.type];
          return (
            <div
              key={`${i}-${b.type}`}
              className="mt-1 flex items-center justify-center gap-1.5 rounded-lg bg-white px-3 py-2 text-sm font-medium text-blue-600 shadow-sm dark:bg-gray-700 dark:text-blue-400"
            >
              {Icon && <Icon aria-hidden className="h-4 w-4" />}
              {b.text || "—"}
            </div>
          );
        })}
      </div>
    </figure>
  );
}
