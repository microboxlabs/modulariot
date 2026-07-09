"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { getContent } from "./content";
import { useLang } from "./useLang";

// Terminal del hero con líneas que aparecen en secuencia (efecto stream en vivo),
// se acumulan y reinician en loop. Mantiene el cursor parpadeante al final.

const tagColor: Record<string, string> = {
  INGESTA: "text-blue-300",
  SINTOMA: "text-rose-400",
  WORKFLOW: "text-green-400",
  SINK: "text-gray-300",
};

export default function HeroTerminal() {
  const c = getContent(useLang()).hero;
  const lines = c.terminalLines;
  const [count, setCount] = useState(0);

  useEffect(() => {
    const t = setInterval(() => {
      setCount((n) => (n >= lines.length ? 0 : n + 1));
    }, 1100);
    return () => clearInterval(t);
  }, [lines.length]);

  return (
    <div className="mx-auto mt-16 max-w-3xl">
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-gray-950 shadow-xl">
        <div className="flex items-center gap-2 border-b border-gray-800 px-4 py-3">
          <span className="h-3 w-3 rounded-full bg-rose-500" />
          <span className="h-3 w-3 rounded-full bg-amber-400" />
          <span className="h-3 w-3 rounded-full bg-green-500" />
          <span className="ml-3 font-mono text-xs text-gray-400">{c.terminalTitle}</span>
        </div>
        <div className="min-h-[168px] space-y-2 px-5 py-5 font-mono text-xs sm:text-sm">
          <AnimatePresence>
            {lines.slice(0, count).map((line) => (
              <motion.div
                key={line.time}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="flex items-start gap-3"
              >
                <span className="text-gray-500">{line.time}</span>
                <span className={`font-semibold ${tagColor[line.tag] || "text-gray-300"}`}>[{line.tag}]</span>
                <span className="text-gray-100">{line.text}</span>
              </motion.div>
            ))}
          </AnimatePresence>
          <div className="flex items-center gap-2 pt-1 text-gray-500">
            <span className="inline-block h-3.5 w-2 animate-pulse bg-gray-400" />
            <span>{count >= lines.length ? "streaming hacia tu nube…" : "recibiendo eventos…"}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
