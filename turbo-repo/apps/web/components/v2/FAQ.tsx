"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useTranslations } from "next-intl";
import { Eyebrow, Section, type Tone } from "./sections/shared";

type FaqItem = { q: string; a: string };

export default function FAQ({ tone }: { tone: Tone }) {
  const t = useTranslations("faq");
  const items = t.raw("items") as FaqItem[];
  const [open, setOpen] = useState<number | null>(0);

  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: { "@type": "Answer", text: item.a },
    })),
  };

  return (
    <Section id="faq" tone={tone}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
      <div className="max-w-[720px]">
        <Eyebrow>{t("kicker")}</Eyebrow>
        <h2 className="display mt-4 text-[clamp(30px,3.8vw,46px)] leading-[1.1]">{t("title")}</h2>
      </div>
      <div className="mt-12 max-w-3xl divide-y divide-hairline rounded-[14px] border border-hairline bg-surface">
        {items.map((item, i) => {
          const abierto = open === i;
          return (
            <div key={item.q}>
              <button
                onClick={() => setOpen(abierto ? null : i)}
                className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left"
                aria-expanded={abierto}
              >
                <span className="text-sm font-semibold text-ink-1 sm:text-base">{item.q}</span>
                <motion.span
                  className="text-2xl leading-none font-light text-ink-4"
                  animate={{ rotate: abierto ? 45 : 0 }}
                  transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                  aria-hidden
                >
                  +
                </motion.span>
              </button>
              <AnimatePresence initial={false}>
                {abierto && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                    className="overflow-hidden"
                  >
                    <p className="px-6 pb-6 text-sm leading-relaxed text-ink-2">{item.a}</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </Section>
  );
}
