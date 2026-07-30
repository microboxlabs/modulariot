"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Section, type Tone } from "./sections/shared";

type FaqItem = { q: string; a: string };

export default function PricingFaq({ tone = "white" }: { tone?: Tone }) {
  const t = useTranslations("pricing.faq");
  const items = t.raw("items") as FaqItem[];
  const [open, setOpen] = useState<number | null>(0);

  return (
    <Section tone={tone}>
      <div className="mx-auto max-w-3xl px-4 py-20 sm:px-6">
        <h2 className="text-center text-3xl font-semibold tracking-[-0.02em] text-ink-1 sm:text-4xl">{t("title")}</h2>
        <div className="mt-12 divide-y divide-hairline rounded-xl border border-hairline bg-surface">
          {items.map((item, i) => {
            const abierto = open === i;
            return (
              <div key={item.q}>
                <button
                  onClick={() => setOpen(abierto ? null : i)}
                  className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left"
                  aria-expanded={abierto}
                >
                  <span className="font-semibold text-ink-1">{item.q}</span>
                  <svg className="h-5 w-5 shrink-0 text-ink-3" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" aria-hidden="true">
                    <path d="M4 10h12" />
                    {!abierto && <path d="M10 4v12" />}
                  </svg>
                </button>
                {abierto && <p className="px-6 pb-6 leading-relaxed text-ink-2">{item.a}</p>}
              </div>
            );
          })}
        </div>
      </div>
    </Section>
  );
}
