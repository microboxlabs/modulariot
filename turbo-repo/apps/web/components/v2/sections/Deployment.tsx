import { getContent } from "../content";
import { Reveal } from "../Reveal";
import { Section, SectionHeader, Check } from "./shared";

export function Deployment({ lang }: { lang: string }) {
  const c = getContent(lang).deployment;
  return (
    <Section id="implementacion" tone="white">
      <SectionHeader kicker={c.kicker} title={c.title} subtitle={c.subtitle} />
      <div className="mt-12 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {c.includes.map((it, i) => {
          const soon = "soon" in it && it.soon;
          return (
            <Reveal
              key={it.title}
              delay={i * 0.06}
              className={`rounded-xl border border-hairline bg-surface p-6 ${soon ? "opacity-60" : ""}`}
            >
              <div className="mb-4 flex items-center justify-between">
                <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${soon ? "bg-surface-3 text-ink-4" : "bg-accent-soft text-accent"}`}>
                  {soon ? (
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  ) : (
                    <Check className="h-5 w-5" />
                  )}
                </div>
                {soon && (
                  <span className="rounded-full bg-surface-3 px-2.5 py-1 font-mono text-[10px] font-medium tracking-[0.08em] text-ink-3 uppercase">
                    {c.soonLabel}
                  </span>
                )}
              </div>
              <h3 className="text-base font-semibold text-ink-1">{it.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-2">{it.body}</p>
            </Reveal>
          );
        })}
      </div>
    </Section>
  );
}
