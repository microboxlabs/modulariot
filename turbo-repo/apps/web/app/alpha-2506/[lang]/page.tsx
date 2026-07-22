import Nav from "../../../components/v2/Nav";
import { Hero } from "../../../components/v2/sections/Hero";
import { Stats } from "../../../components/v2/sections/Stats";
import { Problem } from "../../../components/v2/sections/Problem";
import { TresActos } from "../../../components/v2/sections/TresActos";
import { Features } from "../../../components/v2/sections/Features";
import { Architecture } from "../../../components/v2/sections/Architecture";
import { UseCases } from "../../../components/v2/sections/UseCases";
import { Confiabilidad } from "../../../components/v2/sections/Confiabilidad";
import { PainOutcome } from "../../../components/v2/sections/PainOutcome";
import { Deployment } from "../../../components/v2/sections/Deployment";
import { Stories } from "../../../components/v2/sections/Stories";
import { PricingTeaser } from "../../../components/v2/sections/PricingTeaser";
import { FinalCta } from "../../../components/v2/sections/FinalCta";
import { Footer } from "../../../components/v2/sections/Footer";
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

  return (
    <>
      <Nav />
      <main>
        <Hero base={base} lang={lang} />   {/* Gancho */}
        <Stats lang={lang} />              {/* Validación / cuantificación (banda oscura) */}
        <Problem lang={lang} />            {/* Problema emocional (We Got You) */}
        <TresActos base={base} />          {/* La tesis en 3 actos → explorador nativo */}
        <StepsInteractive />               {/* Demostración paso a paso (autoreproducida) */}
        <Features lang={lang} />           {/* Solución: 3 capacidades */}
        <UseCases lang={lang} />           {/* Las 4 cajas de procesamiento */}
        <Confiabilidad base={base} />      {/* Precisión de señal: 12/20 pulsos/min (minería) */}
        <PainOutcome lang={lang} />        {/* Diferenciación: rentar vs poseer */}
        <Architecture lang={lang} />       {/* Cómo fluye la data */}
        <Deployment lang={lang} />         {/* Opciones de implementación */}
        <Stories lang={lang} />            {/* Prueba social: casos reales */}
        <PricingTeaser base={base} lang={lang} /> {/* Precios */}
        <FAQ />                            {/* Objeciones */}
        <FinalCta lang={lang} />           {/* Cierre */}
      </main>
      <Footer base={base} lang={lang} />
    </>
  );
}
