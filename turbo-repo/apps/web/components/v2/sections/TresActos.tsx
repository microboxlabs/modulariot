import { Reveal } from "../Reveal";
import { Section, SectionHeader, ArrowRight } from "./shared";

// Núcleo narrativo disruptivo. Cada acto abre su módulo nativo en el sitio.
const actos = (base: string) => [
  {
    n: "Acto 1",
    tag: "Ver y reducir",
    title: "Tratas cada alerta, pero las desviaciones vuelven igual.",
    body: "97% de los síntomas se trata… y la mayoría se invalida. Cerrar no es resolver: atacamos la causa que los genera en serie, no el ticket.",
    cta: "Explora la torre de control",
    href: `${base}/torre`,
  },
  {
    n: "Acto 2",
    tag: "Entender a cada actor",
    title: "No un score. Un perfil vivo.",
    body: "La identidad operacional de cada conductor, transportista y activo — su historia, su nivel y su plan. Un mismo motor para cualquier entidad.",
    cta: "Ver SuperProfile",
    href: `${base}/superprofile`,
  },
  {
    n: "Acto 3",
    tag: "Gestionar donde vive la operación",
    title: "La alerta llega con plan y dueño.",
    body: "Correo, WhatsApp, Teams, Webex o SMS. Escalar deja de ser un aviso y pasa a ser el primer paso de la gestión.",
    cta: "Ver canales de escalamiento",
    href: `${base}/canales`,
  },
];

export function TresActos({ base }: { base: string }) {
  const ACTOS = actos(base);
  return (
    <Section id="tesis" tone="gray">
      <SectionHeader
        kicker="La tesis, en 3 actos"
        title="Detectar es barato, pero reducir es el negocio."
        subtitle="El mismo motor de inteligencia, aplicado en tres momentos distintos de tu operación."
      />
      <div className="mt-10 grid gap-6 md:grid-cols-3">
        {ACTOS.map((a, i) => (
          <Reveal
            key={a.n}
            delay={i * 0.08}
            className="flex flex-col rounded-xl border border-gray-200 bg-white p-8 transition-shadow hover:shadow-md"
          >
            <p className="text-xs font-bold tracking-widest text-blue-600 uppercase">
              {a.n} · {a.tag}
            </p>
            <h3 className="mt-3 text-xl font-bold text-gray-950">{a.title}</h3>
            <p className="mt-3 flex-1 leading-relaxed text-gray-600">{a.body}</p>
            <a
              href={a.href}
              className="mt-6 inline-flex items-center gap-1.5 font-semibold text-blue-700 transition-colors hover:text-blue-900"
            >
              {a.cta} <ArrowRight className="transition-transform group-hover:translate-x-0.5" />
            </a>
          </Reveal>
        ))}
      </div>
      <Reveal className="mx-auto mt-10 max-w-2xl text-center">
        <p className="text-sm text-gray-500">
          Lo que ves en el explorador es una operación real (junio 2026), no una maqueta.
        </p>
      </Reveal>
    </Section>
  );
}
