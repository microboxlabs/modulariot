"use client";

import { useState } from "react";
import { getContent } from "./content";
import { useLang } from "./useLang";
import { Eyebrow } from "./sections/shared";

export default function FAQ() {
  const c = getContent(useLang()).faq;
  const [open, setOpen] = useState<number | null>(0);

  return (
    <section id="faq" className="scroll-mt-16 border-y border-hairline bg-page-alt">
      <div className="mx-auto max-w-7xl px-6 py-16 sm:py-20 lg:py-24">
        <div className="max-w-[720px]">
          <Eyebrow>{c.kicker}</Eyebrow>
          <h2 className="display mt-4 text-[clamp(30px,3.8vw,46px)] leading-[1.1]">{c.title}</h2>
        </div>
        <div className="mt-12 max-w-3xl divide-y divide-hairline rounded-[14px] border border-hairline bg-surface">
          {c.items.map((item, i) => {
            const abierto = open === i;
            return (
              <div key={item.q}>
                <button
                  onClick={() => setOpen(abierto ? null : i)}
                  className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left"
                  aria-expanded={abierto}
                >
                  <span className="text-sm font-semibold text-ink-1 sm:text-base">{item.q}</span>
                  <span className="text-2xl font-light text-ink-4" aria-hidden>
                    {abierto ? "–" : "+"}
                  </span>
                </button>
                {abierto && <p className="px-6 pb-6 text-sm leading-relaxed text-ink-2">{item.a}</p>}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
