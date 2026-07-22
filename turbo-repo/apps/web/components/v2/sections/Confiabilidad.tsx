import { Reveal } from "../Reveal";
import { Section, SectionHeader, ArrowRight, btnPrimary } from "./shared";

// Diferenciador de precisión (pulsos/min vs estándar 12/20). Gancho para minería.
// El medidor usa los semánticos del DS: la flota hoy en ámbar (síntoma),
// el estándar ModularIoT en verde (acción), la vara minera en tinta.
export function Confiabilidad({ base }: { base: string }) {
  const FLEET = 3.96,
    STD_MBL = 12,
    STD_MIN = 20,
    GMAX = 24;
  const px = (v: number) => (v / GMAX) * 100;
  return (
    <Section id="confiabilidad" tone="white">
      <SectionHeader
        kicker="Confiabilidad de la señal"
        title="12 pulsos por minuto. El estándar de precisión que marca la diferencia."
        subtitle="La precisión depende de la frecuencia de la señal en movimiento. 12 pulsos por minuto es el estándar de ModularIoT; 20 el que exige la minería. Integramos +28 proveedores GPS y elevamos su señal a esa vara."
      />
      <Reveal className="mt-12 max-w-3xl rounded-[14px] border border-hairline bg-surface p-8 sm:p-10">
        {/* Medidor */}
        <div className="relative">
          <div className="relative h-9 overflow-hidden rounded-lg bg-surface-3">
            <div className="absolute inset-y-0 left-0 rounded-lg bg-symptom/85" style={{ width: `${px(FLEET)}%` }} />
            <div className="absolute inset-y-0 w-0.5 bg-action" style={{ left: `${px(STD_MBL)}%` }} />
            <div className="absolute inset-y-0 w-0.5 bg-ink-1" style={{ left: `${px(STD_MIN)}%` }} />
          </div>
          <div className="relative mt-2 h-5 font-mono text-[11px] font-medium">
            <span className="absolute -translate-x-1/2 text-symptom" style={{ left: `${px(FLEET)}%` }}>
              Flota 3.96
            </span>
            <span className="absolute -translate-x-1/2 text-action" style={{ left: `${px(STD_MBL)}%` }}>
              12 · ModularIoT
            </span>
            <span className="absolute -translate-x-1/2 text-ink-1" style={{ left: `${px(STD_MIN)}%` }}>
              20 · Minería
            </span>
          </div>
        </div>
        {/* Números */}
        <div className="mt-10 grid gap-6 border-t border-hairline pt-8 sm:grid-cols-3">
          <div>
            <p className="display text-3xl tabular-nums">3.96</p>
            <p className="mt-1 text-sm text-ink-3">pulsos/min promedio de la flota hoy</p>
          </div>
          <div>
            <p className="display text-3xl text-action tabular-nums">12/min</p>
            <p className="mt-1 text-sm text-ink-3">el estándar de precisión de ModularIoT</p>
          </div>
          <div>
            <p className="display text-3xl tabular-nums">20/min</p>
            <p className="mt-1 text-sm text-ink-3">el estándar que exige la minería</p>
          </div>
        </div>
        <div className="mt-8 flex flex-wrap items-center gap-4">
          <a href={`${base}/proveedores-gps`} className={btnPrimary}>
            Analiza tus proveedores GPS <ArrowRight />
          </a>
          <p className="text-xs text-ink-4">
            Datos reales de proveedores GPS en operación — medidos, no simulados.
          </p>
        </div>
      </Reveal>
    </Section>
  );
}
