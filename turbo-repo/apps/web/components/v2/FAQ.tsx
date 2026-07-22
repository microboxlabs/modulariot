"use client";

import { useState } from "react";
import { getContent } from "./content";
import { useLang } from "./useLang";

export default function FAQ() {
  const c = getContent(useLang()).faq;
  const [open, setOpen] = useState<number | null>(0);

  return (
    <section id="faq" className="scroll-mt-16 bg-gray-50">
      <div className="mx-auto max-w-3xl px-4 py-20 sm:px-6 sm:py-24 lg:py-32">
        <div className="text-center">
          <p className="mb-4 text-sm font-semibold tracking-widest text-blue-600 uppercase">{c.kicker}</p>
          <h2 className="text-3xl font-bold tracking-tight text-gray-950 sm:text-4xl lg:text-5xl">{c.title}</h2>
        </div>
        <div className="mt-14 divide-y divide-gray-200 rounded-xl border border-gray-200 bg-white">
          {c.items.map((item, i) => {
            const abierto = open === i;
            return (
              <div key={item.q}>
                <button
                  onClick={() => setOpen(abierto ? null : i)}
                  className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left"
                  aria-expanded={abierto}
                >
                  <span className="font-semibold text-gray-950">{item.q}</span>
                  <span className="text-2xl font-light text-gray-400">{abierto ? "–" : "+"}</span>
                </button>
                {abierto && (
                  <p className="px-6 pb-6 leading-relaxed text-gray-600">{item.a}</p>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
