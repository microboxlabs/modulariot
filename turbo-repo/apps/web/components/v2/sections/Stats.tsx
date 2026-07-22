import { getContent } from "../content";
import { Counter } from "../Counter";

export function Stats({ lang }: { lang: string }) {
  const c = getContent(lang).stats;
  return (
    <section className="bg-gray-800">
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <div className="grid grid-cols-2 gap-x-8 gap-y-12 lg:grid-cols-4">
          {c.items.map((s) => (
            <div key={s.label} className="text-center">
              <p className="text-lg font-bold text-gray-300">{s.prefix}</p>
              <p className="text-4xl font-extrabold tracking-tight text-white sm:text-5xl lg:text-6xl">
                <Counter value={s.value} />
              </p>
              <p className="text-sm text-gray-300">{s.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
