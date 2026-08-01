import { Hero } from "../../../components/v2/sections/Hero";
import { TrustedBy } from "../../../components/v2/sections/TrustedBy";
import { Stats } from "../../../components/v2/sections/Stats";
import { Partners } from "../../../components/v2/sections/Partners";
import { Problem } from "../../../components/v2/sections/Problem";
import { TresActos } from "../../../components/v2/sections/TresActos";
import { Features } from "../../../components/v2/sections/Features";
import { PainOutcome } from "../../../components/v2/sections/PainOutcome";
import { Deployment } from "../../../components/v2/sections/Deployment";
import { Security } from "../../../components/v2/sections/Security";
import { Stories } from "../../../components/v2/sections/Stories";
import { FinalCta } from "../../../components/v2/sections/FinalCta";
import { type Tone } from "../../../components/v2/sections/shared";
import StepsInteractive from "../../../components/v2/StepsInteractive";
import FAQ from "../../../components/v2/FAQ";

// Home: arco narrativo estilo luuk.cl con identidad ModularIoT.
// Gancho → validación → problema → demostración → solución → diferenciación →
// arquitectura → implementación → prueba social → precios → objeciones → cierre.
export default async function Home({
  params,
}: {
  params: Promise<{ lang: "en" | "es" | "pt" }>;
}) {
  const { lang } = await params;
  const base = `/alpha-2506/${lang}`;

  // Ritmo de superficies automático: blanco, gris, blanco, gris... en el
  // orden en que las secciones aparecen abajo. Cambiar el orden de las
  // secciones reordena los tonos solo — nada que tocar por sección.
  let toneIndex = 0;
  const tone = (): Tone => (toneIndex++ % 2 === 0 ? "white" : "gray");

  return (
    <main>
      <Hero lang={lang} tone={tone()} /> {/* Gancho */}
      <Stats lang={lang} tone={tone()} />{" "}
      {/* Trust bar: integraciones GPS + stack tecnológico (carruseles) */}
      <Partners tone={tone()} />{" "}
      {/* Validación / cuantificación (banda oscura) */}
      <Problem lang={lang} tone={tone()} />{" "}
      {/* Problema emocional (We Got You) */}
      <TresActos base={base} lang={lang} tone={tone()} />{" "}
      {/* La tesis en 3 actos → explorador nativo */}
      <StepsInteractive tone={tone()} />{" "}
      {/* Demostración paso a paso (autoreproducida) */}
      <Features lang={lang} tone={tone()} /> {/* Solución: 3 capacidades */}
      <PainOutcome lang={lang} tone={tone()} />{" "}
      {/* Diferenciación: rentar vs poseer */}
      <Deployment lang={lang} tone={tone()} />{" "}
      {/* Seguridad & datos: de-riesgo de la decisión (motion demo-led) */}
      <Security lang={lang} tone={tone()} />{" "}
      {/* Opciones de implementación */}
      <TrustedBy lang={lang} tone={tone()} /> {/* Confianza: cliente */}
      <Stories lang={lang} tone={tone()} /> {/* Prueba social: casos reales */}
      <FAQ tone={tone()} /> {/* Objeciones */}
      <FinalCta lang={lang} base={base} tone={tone()} /> {/* Cierre */}
    </main>
  );
}
