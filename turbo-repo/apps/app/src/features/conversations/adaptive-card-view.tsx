"use client";

import { useEffect, useRef } from "react";
import * as AC from "adaptivecards";

/** Teams' light theme, close to what the Adaptive Cards Designer uses for "Microsoft Teams - Light". */
const TEAMS_HOST_CONFIG = {
  supportsInteractivity: true,
  fontFamily: "'Segoe UI', system-ui, -apple-system, sans-serif",
  spacing: {
    small: 4,
    default: 8,
    medium: 12,
    large: 16,
    extraLarge: 24,
    padding: 16,
  },
  separator: { lineThickness: 1, lineColor: "#E1E1E1" },
  fontSizes: { small: 12, default: 14, medium: 14, large: 18, extraLarge: 24 },
  fontWeights: { lighter: 200, default: 400, bolder: 600 },
  imageSizes: { small: 32, medium: 52, large: 100 },
  containerStyles: {
    default: {
      backgroundColor: "#FFFFFF",
      foregroundColors: {
        default: { default: "#242424", subtle: "#616161" },
        accent: { default: "#5B5FC7", subtle: "#5B5FC7" },
        attention: { default: "#C4314B", subtle: "#C4314B" },
        good: { default: "#237B4B", subtle: "#237B4B" },
        warning: { default: "#835C00", subtle: "#835C00" },
      },
    },
    emphasis: {
      backgroundColor: "#F5F5F5",
      foregroundColors: {
        default: { default: "#242424", subtle: "#616161" },
      },
    },
  },
  actions: {
    maxActions: 6,
    spacing: "default",
    buttonSpacing: 8,
    showCard: { actionMode: "inline", inlineTopMargin: 16 },
    actionsOrientation: "horizontal",
    actionAlignment: "left",
  },
  factSet: {
    title: { weight: "bolder", wrap: true, maxWidth: 150 },
    value: { wrap: true },
    spacing: 8,
  },
};

/** Teams draws buttons and facts with its own styles; the renderer only sets classes. */
const TEAMS_CSS = `
.miot-teams-card .ac-adaptiveCard { border-radius: 6px; }
.miot-teams-card .ac-pushButton {
  font: 600 14px 'Segoe UI', system-ui, -apple-system, sans-serif;
  color: #242424; background: #FFFFFF; border: 1px solid #D1D1D1; border-radius: 4px;
  padding: 5px 12px; min-height: 32px; cursor: pointer; overflow: hidden; text-overflow: ellipsis;
}
.miot-teams-card .ac-pushButton:hover { background: #F5F5F5; }
.miot-teams-card .ac-pushButton > div { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.miot-teams-card a { color: #5B5FC7; }
.miot-teams-card p { margin: 0; }
`;

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) =>
    c === "&"
      ? "&amp;"
      : c === "<"
        ? "&lt;"
        : c === ">"
          ? "&gt;"
          : c === '"'
            ? "&quot;"
            : "&#39;"
  );

/** The Markdown Teams draws in a TextBlock: bold, italics, web links and line breaks; everything else as text. */
export function teamsMarkdown(text: string): string {
  return escapeHtml(text)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[\s(])_(.+?)_(?=[\s).,;:!?]|$)/g, "$1<em>$2</em>")
    .replace(
      /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
      '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>'
    )
    .replace(/\n/g, "<br>");
}

AC.AdaptiveCard.onProcessMarkdown = (text, result) => {
  result.outputHtml = teamsMarkdown(text);
  result.didProcess = true;
};

/**
 * An Adaptive Card drawn by Microsoft's renderer with Teams' look: the same renderer the Adaptive Cards Designer
 * uses. A button opens its URL in a new tab.
 */
export default function AdaptiveCardView({
  card,
}: Readonly<{ card: Record<string, unknown> }>) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const host = ref.current;
    if (!host) return;
    const adaptive = new AC.AdaptiveCard();
    adaptive.hostConfig = new AC.HostConfig(TEAMS_HOST_CONFIG);
    adaptive.onExecuteAction = (action) => {
      if (action instanceof AC.OpenUrlAction && action.url)
        window.open(action.url, "_blank", "noopener,noreferrer");
    };
    adaptive.parse(card);
    const rendered = adaptive.render();
    host.replaceChildren(...(rendered ? [rendered] : []));
    return () => host.replaceChildren();
  }, [card]);
  return (
    <div className="miot-teams-card">
      <style>{TEAMS_CSS}</style>
      <div ref={ref} />
    </div>
  );
}
