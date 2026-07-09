"use client";

import { useState } from "react";
import { getContent } from "./content";
import { useLang } from "./useLang";

export default function PricingFaq() {
  const c = getContent(useLang()).pricingPage;
  const [open, setOpen] = useState<number | null>(0);

  return (
    <section className="border-t border-gray-100 bg-gray-50">
      <div className="mx-auto max-w-3xl px-4 py-20 sm:px-6">
        <h2 className="text-center text-3xl font-bold tracking-tight text-gray-950 sm:text-4xl">{c.faqTitle}</h2>
        <div className="mt-12 divide-y divide-gray-200 rounded-xl border border-gray-200 bg-white">
          {c.faqs.map((item, i) => {
            const abierto = open === i;
            return (
              <div key={item.q}>
                <button
                  onClick={() => setOpen(abierto ? null : i)}
                  className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left"
                  aria-expanded={abierto}
                >
                  <span className="font-semibold text-gray-950">{item.q}</span>
                  <svg className="h-5 w-5 shrink-0 text-gray-400" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" aria-hidden="true">
                    <path d="M4 10h12" />
                    {!abierto && <path d="M10 4v12" />}
                  </svg>
                </button>
                {abierto && <p className="px-6 pb-6 leading-relaxed text-gray-600">{item.a}</p>}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
