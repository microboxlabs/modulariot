"use client";

import { useEffect, useId, useState } from "react";

interface MermaidDiagramProps {
  /** The raw diagram source from inside a ```mermaid fence. */
  readonly code: string;
}

function useDarkMode(): boolean {
  const [dark, setDark] = useState(() => {
    if (globalThis.window === undefined) return false;
    return document.documentElement.classList.contains("dark");
  });

  useEffect(() => {
    const target = document.documentElement;
    const observer = new MutationObserver(() => {
      setDark(target.classList.contains("dark"));
    });
    observer.observe(target, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  return dark;
}

/** Renders one ```mermaid code block as an SVG diagram.
 *
 * mermaid is loaded on demand (it's ~1 MB) the first time a diagram
 * actually shows up, and re-rendered when the app theme flips so the
 * diagram's colors follow light/dark like everything else. A parse error
 * falls back to showing the source verbatim rather than blanking the
 * block — a malformed diagram in a story shouldn't hide its own text. */
export function MermaidDiagram({ code }: Readonly<MermaidDiagramProps>) {
  const dark = useDarkMode();
  // mermaid.render uses this as a DOM id and a querySelector — strip
  // useId's delimiters (":" today, could be other punctuation) to keep it a
  // plain selector-safe token.
  const domId = `mermaid-${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const [svg, setSvg] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const mermaid = (await import("mermaid")).default;
        mermaid.initialize({
          startOnLoad: false,
          securityLevel: "strict",
          theme: dark ? "dark" : "default",
        });
        const { svg: rendered } = await mermaid.render(domId, code.trim());
        if (!cancelled) {
          setSvg(rendered);
          setFailed(false);
        }
      } catch {
        if (!cancelled) {
          setSvg(null);
          setFailed(true);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [code, dark, domId]);

  if (failed) {
    return (
      <pre className="overflow-x-auto rounded-lg border border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800">
        <code className="text-gray-800 dark:text-gray-200">{code}</code>
      </pre>
    );
  }

  if (svg === null) {
    return (
      <div className="flex justify-center py-6 text-xs text-gray-400 dark:text-gray-500">
        …
      </div>
    );
  }

  return (
    <div
      className="flex justify-center overflow-x-auto"
      // mermaid returns a self-contained, sanitized SVG string (securityLevel
      // "strict" strips scripts/handlers) built from story Markdown the user
      // already controls — rendering it as markup is the whole point.
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
