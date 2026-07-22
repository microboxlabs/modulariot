import { Reveal } from "../Reveal";
import { Section, SectionHeader, ArrowRight } from "./shared";

// Diferenciador de precisión (pulsos/min vs estándar 12/20). Gancho para minería.
export function Confiabilidad({ base }: { base: string }) {
  const FLEET = 3.96,
    STD_MBL = 12,
    STD_MIN = 20,
    GMAX = 24;
  const px = (v: number) => (v / GMAX) * 100;
  return (
    <Section id="confiabilidad" tone="gray">
      <SectionHeader
        kicker="Confiabilidad de la señal"
        title="12 pulsos por minuto. El estándar de precisión que marca la diferencia."
        subtitle="La precisión depende de la frecuencia de la señal en movimiento. 12 pulsos por minuto es el estándar de ModularIoT; 20 el que exige la minería. Integramos +28 proveedores GPS y elevamos su señal a esa vara."
      />
      <Reveal className="mx-auto mt-14 max-w-3xl rounded-xl border border-gray-200 bg-white p-8 sm:p-10">
        {/* Medidor */}
        <div className="relative">
          <div className="relative h-9 overflow-hidden rounded-lg bg-gray-100">
            <div className="absolute inset-y-0 left-0 rounded-lg bg-amber-500/85" style={{ width: `${px(FLEET)}%` }} />
            <div className="absolute inset-y-0 w-0.5 bg-green-600" style={{ left: `${px(STD_MBL)}%` }} />
            <div className="absolute inset-y-0 w-0.5 bg-green-800" style={{ left: `${px(STD_MIN)}%` }} />
          </div>
          <div className="relative mt-2 h-5 text-xs font-semibold">
            <span className="absolute -translate-x-1/2 text-amber-700" style={{ left: `${px(FLEET)}%` }}>
              Flota 3.96
            </span>
            <span className="absolute -translate-x-1/2 text-green-700" style={{ left: `${px(STD_MBL)}%` }}>
              12 · ModularIoT
            </span>
            <span className="absolute -translate-x-1/2 text-green-900" style={{ left: `${px(STD_MIN)}%` }}>
              20 · Minería
            </span>
          </div>
        </div>
        {/* Números */}
        <div className="mt-12 grid gap-6 border-t border-gray-100 pt-8 sm:grid-cols-3">
          <div className="text-center">
            <p className="text-4xl font-extrabold text-gray-950">3.96</p>
            <p className="mt-1 text-sm text-gray-600">pulsos/min promedio de la flota hoy</p>
          </div>
          <div className="text-center">
            <p className="text-4xl font-extrabold text-green-700">12/min</p>
            <p className="mt-1 text-sm text-gray-600">el estándar de precisión de ModularIoT</p>
          </div>
          <div className="text-center">
            <p className="text-4xl font-extrabold text-gray-950">20/min</p>
            <p className="mt-1 text-sm text-gray-600">el estándar que exige la minería</p>
          </div>
        </div>
        <div className="mt-8 text-center">
          <a
            href={`${base}/proveedores-gps`}
            className="inline-flex items-center gap-1.5 rounded-lg bg-gray-950 px-6 py-3 font-semibold text-white transition-colors hover:bg-gray-800"
          >
            Analiza tus proveedores GPS <ArrowRight />
          </a>
          <p className="mt-6 text-xs text-gray-400">
            Datos reales de proveedores GPS en operación — medidos, no simulados.
          </p>
        </div>
      </Reveal>
    </Section>
  );
}
