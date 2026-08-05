"use client";

import { useMemo, useState } from "react";
import { getTorre, getModules } from "./module-i18n";
import { symDim, DIM_COLOR, type Entity } from "./torre-modules-data";

// ============================================================
// Acto 2 · SuperProfile — la identidad operacional viva de cada entidad.
// Port nativo (Design System) de la sección /torre.html#superprofile.
// Sin score abstracto: nivel, riesgo, historia, comportamiento y plan
// derivados de los síntomas reales de junio 2026.
// ============================================================

const fmt = (n: number) => n.toLocaleString("es-CL");
const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 100) : 0);

type Sym = ReturnType<typeof getTorre>["SYMPTOMS"][number];

// ------------------------------------------------------------
// Diccionario trilingüe de textos de interfaz (es / en / pt).
// Solo strings de UI; los valores de datos vienen de los resolvers.
// ------------------------------------------------------------
const UI = {
  es: {
    actLabel: "Acto 2 · Entender a cada actor",
    title: "SuperProfile — la identidad operacional viva de cada entidad",
    intro1: "Un perfil construido por ",
    introB1: "evaluación continua del comportamiento observado",
    intro2:
      ". No reemplaza licencias ni acreditaciones legales: consolida historia, estado actual, tendencia, evidencia y planes de mejora. ",
    introB2: "El score es solo un componente",
    intro3: "; el producto es el perfil vivo.",
    chips: ["Historia", "Estado actual", "Comportamiento", "Evidencia", "Mejora continua"],
    cycleLabel: "El ciclo de valor",
    cycleTitle: "Ver → Entender → Actuar → Resolver → Mejorar",
    CYCLE: [
      ["Ver", "Recolectar señales, síntomas, eventos, tratamientos y evidencia."],
      ["Entender", "Contextualizar por entidad, ruta, horario, zona, responsable y recurrencia."],
      ["Actuar", "Asignar responsable, SLA, tarea, decisión y cierre trazable."],
      ["Resolver", "Causa probable, control faltante y plan correctivo/preventivo."],
      ["Mejorar", "Medir tendencia y reducción de desviaciones tras intervenir."],
    ] as [string, string][],
    archLabel: "Arquitectura común",
    archTitle: "Todo SuperProfile comparte la misma estructura",
    ARCH: [
      ["Identidad", "Datos maestros, relaciones, documentos y contexto de la entidad."],
      ["Estado actual", "Nivel operacional, riesgo, restricciones, habilitaciones y alertas abiertas."],
      ["Historia operacional", "Eventos, síntomas, tratamientos, viajes, cambios de estado y evidencia."],
      ["Comportamiento observado", "Seguridad, cumplimiento, eficiencia, confiabilidad, disponibilidad, trazabilidad."],
      ["Patrones", "Recurrencias, concentración por hora/zona/proveedor/proceso y anomalías."],
      ["Planes de mejora", "Acción correctiva/preventiva, dueño, fecha, verificación y resultado."],
    ] as [string, string][],
    entsLabel: "SuperProfiles por entidad",
    entsTitle: "Mismo espíritu, distinto foco analítico",
    ENTS: [
      ["SuperProfile Conductor", "Persona operacional", "¿Opera de forma segura, cumplidora y consistente?"],
      ["SuperProfile Transportista", "Empresa / proveedor", "¿Qué tan confiable es como proveedor operacional?"],
      ["SuperProfile Camión / Activo", "Activo", "¿Está disponible, trazable y apto para operar?"],
      ["SuperProfile Operación", "Terminal / área", "¿Funciona dentro del estándar de flujo y seguridad?"],
      ["SuperProfile Ruta", "Corredor", "¿Qué nivel de riesgo y confiabilidad tiene el corredor?"],
    ] as [string, string, string][],
    demoLabel: "Demo en vivo · gestión consumiendo datos",
    demoTitle: "Un SuperProfile poblado con la operación real de junio",
    demo1:
      "Así se ve consumir el dato: eliges una entidad y la plataforma arma su perfil vivo desde los síntomas reales — nivel, riesgo, historia, comportamiento y plan.",
    demoB: " Sin score abstracto: gestión desde la historia.",
    carriers: "Transportistas",
    drivers: "Conductores",
    symptomsWord: "síntomas",
    commLabel: "Principio de comunicación",
    commA: "SuperProfile no es licencia legal ni acreditación formal. Se comunica como ",
    commB: "evaluación operacional interna",
    commC:
      ": «nivel operacional», «estado observado», «perfil vivo», «confiabilidad operacional» — bajo las reglas y estándares definidos por la organización.",
    spCarrier: "Transportista",
    spDriver: "Conductor",
    kpiLevel: "Nivel operacional",
    kpiConf: "Confianza",
    kpiRisk: "Riesgo actual",
    kpiEval: "Evaluación",
    evalValue: "Jun 2026",
    risk: { high: "Alto", medium: "Medio", low: "Bajo" },
    conf: { high: "Alta", medium: "Media", low: "Baja" },
    riskWord: "Riesgo",
    levelWord: "Nivel",
    hIdentidad: "Identidad",
    hEstado: "Estado actual",
    hPatrones: "Patrones",
    hHistoria: "Historia · top síntomas",
    hComport: "Comportamiento observado",
    hPlan: "Plan de mejora",
    wConductores: "conductores",
    wActivos: "activos",
    wViajesMes: "viajes en el mes",
    wViajes: "viajes",
    idCarrier: "Empresa transportista.",
    idDriver: "Persona operacional.",
    idCarrierMid1: "conductores y",
    idCarrierMid2: "activos asociados.",
    idPertenece: "Pertenece a",
    evidenceLabel: "Base de evidencia:",
    evidenceTail: "síntomas en junio.",
    stSintomas: "síntomas",
    stCodigoNegro: "código negro",
    stTratValidos: "de tratamientos válidos.",
    patLead: "Su comportamiento se concentra en",
    patParenA: "del total,",
    patParenB: "en código negro",
    patCarrier: "La reincidencia se agrega desde sus conductores y activos.",
    patDriver: "Reincidencia individual comparada contra su transportista.",
    planActionLabel: "Acción:",
    planActionFallback: "Corrección estructural",
    planOwnerLabel: "Dueño:",
    planOwnerFallback: "Operaciones",
    planMetaLabel: "Meta:",
    planMetaA: "−30% de",
    planMetaB: "en 60 días.",
    planVerifLabel: "Verificación:",
    planVerifText: "recurrencia mensual.",
    clSpOf: "El SuperProfile de",
    clBuilds: "se arma solo desde los",
    clSymJune: "síntomas de junio:",
    clLevelW: "nivel",
    clRiskW: "riesgo",
    clFocus: "foco en",
    clMgmtLead:
      "La gestión no parte de un número abstracto — parte de la historia: se asigna el plan (",
    clToOwner: ") al dueño (",
    clTail: ") y se mide si la recurrencia baja el próximo mes.",
  },
  en: {
    actLabel: "Act 2 · Understand every actor",
    title: "SuperProfile — the living operational identity of every entity",
    intro1: "A profile built through ",
    introB1: "continuous evaluation of observed behavior",
    intro2:
      ". It does not replace licenses or legal accreditations: it consolidates history, current state, trend, evidence and improvement plans. ",
    introB2: "The score is just one component",
    intro3: "; the product is the living profile.",
    chips: ["History", "Current state", "Behavior", "Evidence", "Continuous improvement"],
    cycleLabel: "The value cycle",
    cycleTitle: "See → Understand → Act → Resolve → Improve",
    CYCLE: [
      ["See", "Collect signals, symptoms, events, treatments and evidence."],
      ["Understand", "Contextualize by entity, route, schedule, zone, owner and recurrence."],
      ["Act", "Assign owner, SLA, task, decision and traceable closure."],
      ["Resolve", "Probable cause, missing control and corrective/preventive plan."],
      ["Improve", "Measure trend and reduction of deviations after intervening."],
    ] as [string, string][],
    archLabel: "Common architecture",
    archTitle: "Every SuperProfile shares the same structure",
    ARCH: [
      ["Identity", "Master data, relationships, documents and context of the entity."],
      ["Current state", "Operational level, risk, restrictions, clearances and open alerts."],
      ["Operational history", "Events, symptoms, treatments, trips, status changes and evidence."],
      ["Observed behavior", "Safety, compliance, efficiency, reliability, availability, traceability."],
      ["Patterns", "Recurrences, concentration by hour/zone/provider/process and anomalies."],
      ["Improvement plans", "Corrective/preventive action, owner, date, verification and outcome."],
    ] as [string, string][],
    entsLabel: "SuperProfiles by entity",
    entsTitle: "Same spirit, different analytical focus",
    ENTS: [
      ["SuperProfile Driver", "Operational person", "Does it operate safely, compliantly and consistently?"],
      ["SuperProfile Carrier", "Company / provider", "How reliable is it as an operational provider?"],
      ["SuperProfile Truck / Asset", "Asset", "Is it available, traceable and fit to operate?"],
      ["SuperProfile Operation", "Terminal / area", "Does it run within the flow and safety standard?"],
      ["SuperProfile Route", "Corridor", "What level of risk and reliability does the corridor have?"],
    ] as [string, string, string][],
    demoLabel: "Live demo · management consuming data",
    demoTitle: "A SuperProfile populated with the real June operation",
    demo1:
      "This is what consuming the data looks like: you pick an entity and the platform builds its living profile from the real symptoms — level, risk, history, behavior and plan.",
    demoB: " No abstract score: management from the history.",
    carriers: "Carriers",
    drivers: "Drivers",
    symptomsWord: "symptoms",
    commLabel: "Communication principle",
    commA: "SuperProfile is not a legal license or formal accreditation. It is communicated as ",
    commB: "internal operational evaluation",
    commC:
      ": “operational level”, “observed state”, “living profile”, “operational reliability” — under the rules and standards defined by the organization.",
    spCarrier: "Carrier",
    spDriver: "Driver",
    kpiLevel: "Operational level",
    kpiConf: "Confidence",
    kpiRisk: "Current risk",
    kpiEval: "Evaluation",
    evalValue: "Jun 2026",
    risk: { high: "High", medium: "Medium", low: "Low" },
    conf: { high: "High", medium: "Medium", low: "Low" },
    riskWord: "Risk",
    levelWord: "Level",
    hIdentidad: "Identity",
    hEstado: "Current state",
    hPatrones: "Patterns",
    hHistoria: "History · top symptoms",
    hComport: "Observed behavior",
    hPlan: "Improvement plan",
    wConductores: "drivers",
    wActivos: "assets",
    wViajesMes: "trips in the month",
    wViajes: "trips",
    idCarrier: "Carrier company.",
    idDriver: "Operational person.",
    idCarrierMid1: "drivers and",
    idCarrierMid2: "associated assets.",
    idPertenece: "Belongs to",
    evidenceLabel: "Evidence base:",
    evidenceTail: "symptoms in June.",
    stSintomas: "symptoms",
    stCodigoNegro: "black code",
    stTratValidos: "of valid treatments.",
    patLead: "Its behavior concentrates on",
    patParenA: "of the total,",
    patParenB: "in black code",
    patCarrier: "Recurrence is aggregated from its drivers and assets.",
    patDriver: "Individual recurrence compared against its carrier.",
    planActionLabel: "Action:",
    planActionFallback: "Structural correction",
    planOwnerLabel: "Owner:",
    planOwnerFallback: "Operations",
    planMetaLabel: "Goal:",
    planMetaA: "−30% of",
    planMetaB: "in 60 days.",
    planVerifLabel: "Verification:",
    planVerifText: "monthly recurrence.",
    clSpOf: "The SuperProfile of",
    clBuilds: "builds itself from the",
    clSymJune: "symptoms of June:",
    clLevelW: "level",
    clRiskW: "risk",
    clFocus: "focus on",
    clMgmtLead:
      "Management does not start from an abstract number — it starts from the history: the plan is assigned (",
    clToOwner: ") to the owner (",
    clTail: ") and whether recurrence drops next month is measured.",
  },
  pt: {
    actLabel: "Ato 2 · Entender cada ator",
    title: "SuperProfile — a identidade operacional viva de cada entidade",
    intro1: "Um perfil construído por ",
    introB1: "avaliação contínua do comportamento observado",
    intro2:
      ". Não substitui licenças nem credenciamentos legais: consolida histórico, estado atual, tendência, evidências e planos de melhoria. ",
    introB2: "O score é apenas um componente",
    intro3: "; o produto é o perfil vivo.",
    chips: ["Histórico", "Estado atual", "Comportamento", "Evidência", "Melhoria contínua"],
    cycleLabel: "O ciclo de valor",
    cycleTitle: "Ver → Entender → Agir → Resolver → Melhorar",
    CYCLE: [
      ["Ver", "Coletar sinais, sintomas, eventos, tratamentos e evidências."],
      ["Entender", "Contextualizar por entidade, rota, horário, zona, responsável e recorrência."],
      ["Agir", "Atribuir responsável, SLA, tarefa, decisão e encerramento rastreável."],
      ["Resolver", "Causa provável, controle faltante e plano corretivo/preventivo."],
      ["Melhorar", "Medir tendência e redução de desvios após intervir."],
    ] as [string, string][],
    archLabel: "Arquitetura comum",
    archTitle: "Todo SuperProfile compartilha a mesma estrutura",
    ARCH: [
      ["Identidade", "Dados mestres, relações, documentos e contexto da entidade."],
      ["Estado atual", "Nível operacional, risco, restrições, habilitações e alertas abertos."],
      ["Histórico operacional", "Eventos, sintomas, tratamentos, viagens, mudanças de estado e evidências."],
      ["Comportamento observado", "Segurança, conformidade, eficiência, confiabilidade, disponibilidade, rastreabilidade."],
      ["Padrões", "Recorrências, concentração por hora/zona/fornecedor/processo e anomalias."],
      ["Planos de melhoria", "Ação corretiva/preventiva, responsável, data, verificação e resultado."],
    ] as [string, string][],
    entsLabel: "SuperProfiles por entidade",
    entsTitle: "Mesmo espírito, foco analítico distinto",
    ENTS: [
      ["SuperProfile Motorista", "Pessoa operacional", "Opera de forma segura, cumpridora e consistente?"],
      ["SuperProfile Transportadora", "Empresa / fornecedor", "Quão confiável é como fornecedor operacional?"],
      ["SuperProfile Caminhão / Ativo", "Ativo", "Está disponível, rastreável e apto para operar?"],
      ["SuperProfile Operação", "Terminal / área", "Funciona dentro do padrão de fluxo e segurança?"],
      ["SuperProfile Rota", "Corredor", "Qual nível de risco e confiabilidade tem o corredor?"],
    ] as [string, string, string][],
    demoLabel: "Demo ao vivo · gestão consumindo dados",
    demoTitle: "Um SuperProfile preenchido com a operação real de junho",
    demo1:
      "É assim que se vê consumir o dado: você escolhe uma entidade e a plataforma monta seu perfil vivo a partir dos sintomas reais — nível, risco, histórico, comportamento e plano.",
    demoB: " Sem score abstrato: gestão a partir do histórico.",
    carriers: "Transportadoras",
    drivers: "Motoristas",
    symptomsWord: "sintomas",
    commLabel: "Princípio de comunicação",
    commA: "SuperProfile não é licença legal nem credenciamento formal. É comunicado como ",
    commB: "avaliação operacional interna",
    commC:
      ": «nível operacional», «estado observado», «perfil vivo», «confiabilidade operacional» — sob as regras e padrões definidos pela organização.",
    spCarrier: "Transportadora",
    spDriver: "Motorista",
    kpiLevel: "Nível operacional",
    kpiConf: "Confiança",
    kpiRisk: "Risco atual",
    kpiEval: "Avaliação",
    evalValue: "Jun 2026",
    risk: { high: "Alto", medium: "Médio", low: "Baixo" },
    conf: { high: "Alta", medium: "Média", low: "Baixa" },
    riskWord: "Risco",
    levelWord: "Nível",
    hIdentidad: "Identidade",
    hEstado: "Estado atual",
    hPatrones: "Padrões",
    hHistoria: "Histórico · principais sintomas",
    hComport: "Comportamento observado",
    hPlan: "Plano de melhoria",
    wConductores: "motoristas",
    wActivos: "ativos",
    wViajesMes: "viagens no mês",
    wViajes: "viagens",
    idCarrier: "Empresa transportadora.",
    idDriver: "Pessoa operacional.",
    idCarrierMid1: "motoristas e",
    idCarrierMid2: "ativos associados.",
    idPertenece: "Pertence a",
    evidenceLabel: "Base de evidências:",
    evidenceTail: "sintomas em junho.",
    stSintomas: "sintomas",
    stCodigoNegro: "código preto",
    stTratValidos: "de tratamentos válidos.",
    patLead: "Seu comportamento se concentra em",
    patParenA: "do total,",
    patParenB: "em código preto",
    patCarrier: "A reincidência é agregada a partir de seus motoristas e ativos.",
    patDriver: "Reincidência individual comparada com sua transportadora.",
    planActionLabel: "Ação:",
    planActionFallback: "Correção estrutural",
    planOwnerLabel: "Responsável:",
    planOwnerFallback: "Operações",
    planMetaLabel: "Meta:",
    planMetaA: "−30% de",
    planMetaB: "em 60 dias.",
    planVerifLabel: "Verificação:",
    planVerifText: "recorrência mensal.",
    clSpOf: "O SuperProfile de",
    clBuilds: "se monta sozinho a partir dos",
    clSymJune: "sintomas de junho:",
    clLevelW: "nível",
    clRiskW: "risco",
    clFocus: "foco em",
    clMgmtLead:
      "A gestão não parte de um número abstrato — parte do histórico: atribui-se o plano (",
    clToOwner: ") ao responsável (",
    clTail: ") e mede-se se a reincidência cai no próximo mês.",
  },
} as const;

function levelOf(negro: number) {
  return negro < 8 ? "A" : negro < 15 ? "B" : negro < 25 ? "C" : "D";
}
function riskOf(negro: number): ["high" | "medium" | "low", string] {
  return negro >= 15 ? ["high", "bg-rose-100 text-rose-700"] : negro >= 8 ? ["medium", "bg-amber-100 text-amber-700"] : ["low", "bg-green-100 text-green-700"];
}
function confOf(total: number): "high" | "medium" | "low" {
  return total > 3000 ? "high" : total > 800 ? "medium" : "low";
}

function Bar({ value, max, color = "bg-blue-500" }: { value: number; max: number; color?: string }) {
  return (
    <div className="h-1.5 overflow-hidden rounded-full bg-surface-3">
      <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.max(3, pct(value, max))}%` }} />
    </div>
  );
}

function ProfileCard({
  e,
  isC,
  t,
  nice,
  byTech,
}: {
  e: Entity;
  isC: boolean;
  t: (typeof UI)[keyof typeof UI];
  nice: (tn: string) => string;
  byTech: Record<string, Sym>;
}) {
  const negro = pct(e.icu4, e.total);
  const level = levelOf(negro);
  const [riskKey, riskCls] = riskOf(negro);
  const risk = t.risk[riskKey];
  const conf = t.conf[confOf(e.total)];
  const top = e.symptoms[0];
  const cat = byTech[top.name];
  const hist = e.symptoms.slice(0, 6);
  const hmax = Math.max(1, ...hist.map((s) => s.c));

  const dims = useMemo(() => {
    const d: Record<string, number> = {};
    e.symptoms.forEach((s) => { const k = symDim(s.name); d[k] = (d[k] || 0) + s.c; });
    return Object.entries(d).sort((a, b) => b[1] - a[1]);
  }, [e]);
  const validPct = e.con_tratamiento ? pct(e.validos, e.con_tratamiento) : 0;

  return (
    <div className="mt-6 overflow-hidden rounded-xl border border-hairline bg-surface">
      {/* Cabecera del perfil */}
      <div className="flex flex-col gap-5 border-b border-hairline bg-surface-2/60 p-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-accent">SuperProfile · {isC ? t.spCarrier : t.spDriver}</p>
          <h3 className="mt-1 text-xl font-semibold text-ink-1">{e.name}</h3>
          <p className="mt-1 text-sm text-ink-3">
            {isC
              ? `${fmt(e.conductores || 0)} ${t.wConductores} · ${fmt(e.assets)} ${t.wActivos} · ${fmt(e.viajes)} ${t.wViajesMes}`
              : `${e.carrier || "—"} · ${fmt(e.assets)} ${t.wActivos} · ${fmt(e.viajes)} ${t.wViajes}`}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[[t.kpiLevel, level], [t.kpiConf, conf], [t.kpiRisk, risk], [t.kpiEval, t.evalValue]].map(([k, v]) => (
            <div key={k} className="rounded-lg border border-hairline bg-surface px-3 py-2 text-center">
              <p className="text-[10px] font-medium uppercase tracking-wide text-ink-3">{k}</p>
              <p className="mt-0.5 text-base font-semibold tracking-[-0.02em] text-ink-1">{v}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Módulos */}
      <div className="grid gap-5 p-6 md:grid-cols-2 lg:grid-cols-3">
        <div>
          <h4 className="text-sm font-semibold text-ink-1">{t.hIdentidad}</h4>
          <p className="mt-2 text-sm leading-relaxed text-ink-2">
            {isC ? t.idCarrier : t.idDriver}{" "}
            {isC ? `${fmt(e.conductores || 0)} ${t.idCarrierMid1} ${fmt(e.assets)} ${t.idCarrierMid2}` : `${t.idPertenece} ${e.carrier || "—"}.`}{" "}
            {t.evidenceLabel} <b>{fmt(e.total)}</b> {t.evidenceTail}
          </p>
        </div>
        <div>
          <h4 className="text-sm font-semibold text-ink-1">{t.hEstado}</h4>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${riskCls}`}>{t.riskWord} {risk}</span>
            <span className="rounded-full bg-accent-soft px-2 py-0.5 text-xs font-semibold text-accent">{t.levelWord} {level}</span>
          </div>
          <p className="mt-2 text-sm leading-relaxed text-ink-2">
            <b>{fmt(e.total)}</b> {t.stSintomas} · <b className="text-rose-600">{negro}%</b> {t.stCodigoNegro} · <b>{validPct}%</b> {t.stTratValidos}
          </p>
        </div>
        <div>
          <h4 className="text-sm font-semibold text-ink-1">{t.hPatrones}</h4>
          <p className="mt-2 text-sm leading-relaxed text-ink-2">
            {t.patLead} <b>{nice(top.name)}</b> ({pct(top.c, e.total)}% {t.patParenA} {fmt(top.icu4)} {t.patParenB}).{" "}
            {isC ? t.patCarrier : t.patDriver}
          </p>
        </div>
        <div>
          <h4 className="text-sm font-semibold text-ink-1">{t.hHistoria}</h4>
          <div className="mt-3 space-y-2">
            {hist.map((s) => (
              <div key={s.name}>
                <div className="flex justify-between text-xs text-ink-2"><span>{nice(s.name)}</span><span className="tabular-nums text-ink-3">{fmt(s.c)}</span></div>
                <div className="mt-1"><Bar value={s.c} max={hmax} /></div>
              </div>
            ))}
          </div>
        </div>
        <div>
          <h4 className="text-sm font-semibold text-ink-1">{t.hComport}</h4>
          <div className="mt-3 space-y-2">
            {dims.map(([dim, val]) => (
              <div key={dim}>
                <div className="flex justify-between text-xs text-ink-2"><span>{dim}</span><span className="tabular-nums text-ink-3">{pct(val, e.total)}%</span></div>
                <div className="mt-1"><Bar value={val} max={e.total} color={DIM_COLOR[dim]} /></div>
              </div>
            ))}
          </div>
        </div>
        <div>
          <h4 className="text-sm font-semibold text-ink-1">{t.hPlan}</h4>
          <div className="mt-2 space-y-1 text-sm leading-relaxed text-ink-2">
            <p><b>{t.planActionLabel}</b> {cat?.action || t.planActionFallback}.</p>
            <p><b>{t.planOwnerLabel}</b> {cat?.owner || t.planOwnerFallback}.</p>
            <p><b>{t.planMetaLabel}</b> {t.planMetaA} {nice(top.name)} {t.planMetaB}</p>
            <p><b>{t.planVerifLabel}</b> {t.planVerifText}</p>
          </div>
        </div>
      </div>

      {/* Cierre */}
      <div className="border-t border-hairline bg-accent-soft/50 px-6 py-4">
        <p className="text-sm leading-relaxed text-ink-2">
          {t.clSpOf} <b>{e.name}</b> {t.clBuilds} {fmt(e.total)} {t.clSymJune} {t.clLevelW} <b>{level}</b>, {t.clRiskW} <b>{risk}</b>, {t.clFocus} <b>{nice(top.name)}</b>.
          {t.clMgmtLead}<b>{cat?.action || "—"}</b>{t.clToOwner}<b>{cat?.owner || t.planOwnerFallback}</b>{t.clTail}
        </p>
      </div>
    </div>
  );
}

export default function SuperProfile({ lang }: { lang: string }) {
  const t = UI[(lang as "es" | "en" | "pt")] ?? UI.es;
  const { SYMPTOMS } = getTorre(lang);
  const { ENTITY_DATA } = getModules(lang);

  // Mapa technicalName → nombre bonito / owner / action (según idioma activo).
  const byTech = useMemo(() => Object.fromEntries(SYMPTOMS.map((s) => [s.technicalName, s])) as Record<string, Sym>, [SYMPTOMS]);
  const nice = (tn: string) => byTech[tn]?.name || tn;

  const [type, setType] = useState<"carrier" | "driver">("carrier");
  const [idx, setIdx] = useState(0);
  const list = type === "carrier" ? ENTITY_DATA.carriers : ENTITY_DATA.drivers;
  const e = list[Math.min(idx, list.length - 1)];

  return (
    <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:py-20">
      <p className="text-sm font-semibold uppercase tracking-widest text-accent">{t.actLabel}</p>
      <h1 className="mt-4 max-w-4xl text-4xl font-semibold tracking-[-0.02em] text-ink-1 sm:text-5xl">
        {t.title}
      </h1>
      <p className="mt-6 max-w-3xl text-lg leading-relaxed text-ink-2">
        {t.intro1}<b>{t.introB1}</b>{t.intro2}<b>{t.introB2}</b>{t.intro3}
      </p>
      <div className="mt-5 flex flex-wrap gap-2">
        {t.chips.map((c) => (
          <span key={c} className="rounded-full border border-hairline bg-surface-2 px-3 py-1 text-xs font-medium text-ink-2">{c}</span>
        ))}
      </div>

      {/* Ciclo de valor */}
      <div className="mt-16">
        <p className="text-xs font-semibold uppercase tracking-widest text-accent">{t.cycleLabel}</p>
        <h2 className="mt-2 text-2xl font-semibold text-ink-1">{t.cycleTitle}</h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {t.CYCLE.map(([c, d], i) => (
            <div key={c} className="rounded-xl border border-hairline bg-surface p-5">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-accent text-sm font-semibold text-white">{i + 1}</span>
              <h5 className="mt-3 font-semibold text-ink-1">{c}</h5>
              <p className="mt-1 text-sm leading-relaxed text-ink-2">{d}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Arquitectura común */}
      <div className="mt-16">
        <p className="text-xs font-semibold uppercase tracking-widest text-accent">{t.archLabel}</p>
        <h2 className="mt-2 text-2xl font-semibold text-ink-1">{t.archTitle}</h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {t.ARCH.map(([c, d]) => (
            <div key={c} className="rounded-xl border border-hairline bg-surface p-5">
              <h4 className="font-semibold text-ink-1">{c}</h4>
              <p className="mt-1.5 text-sm leading-relaxed text-ink-2">{d}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Entidades */}
      <div className="mt-16">
        <p className="text-xs font-semibold uppercase tracking-widest text-accent">{t.entsLabel}</p>
        <h2 className="mt-2 text-2xl font-semibold text-ink-1">{t.entsTitle}</h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {t.ENTS.map(([c, sub, q]) => (
            <div key={c} className="rounded-xl border border-hairline bg-surface p-5">
              <h4 className="font-semibold text-ink-1">{c}</h4>
              <span className="mt-2 inline-block rounded-md bg-surface-3 px-2 py-0.5 text-[11px] font-semibold text-ink-2">{sub}</span>
              <p className="mt-2 text-sm leading-relaxed text-ink-2">{q}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Demo en vivo */}
      <div className="mt-16">
        <p className="text-xs font-semibold uppercase tracking-widest text-accent">{t.demoLabel}</p>
        <h2 className="mt-2 text-2xl font-semibold text-ink-1">{t.demoTitle}</h2>
        <p className="mt-3 max-w-3xl leading-relaxed text-ink-2">
          {t.demo1}
          <b>{t.demoB}</b>
        </p>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <div className="inline-flex rounded-lg border border-hairline bg-surface p-1">
            {(["carrier", "driver"] as const).map((bt) => (
              <button
                key={bt}
                onClick={() => { setType(bt); setIdx(0); }}
                className={`rounded-md px-4 py-1.5 text-sm font-semibold transition-colors ${type === bt ? "bg-accent text-white" : "text-ink-2 hover:text-ink-1"}`}
              >
                {bt === "carrier" ? t.carriers : t.drivers}
              </button>
            ))}
          </div>
          <select
            value={Math.min(idx, list.length - 1)}
            onChange={(ev) => setIdx(+ev.target.value)}
            className="max-w-sm rounded-lg border border-hairline-strong bg-surface px-3.5 py-2 text-sm text-ink-1 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
          >
            {list.map((it, i) => (
              <option key={it.name} value={i}>{it.name} — {fmt(it.total)} {t.symptomsWord}</option>
            ))}
          </select>
        </div>

        {e && <ProfileCard e={e} isC={type === "carrier"} t={t} nice={nice} byTech={byTech} />}
      </div>

      {/* Principio de comunicación */}
      <div className="mt-10 rounded-xl border-l-4 border-amber-400 bg-amber-50 px-5 py-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">{t.commLabel}</p>
        <p className="mt-1.5 text-sm font-medium leading-relaxed text-ink-2">
          {t.commA}<b>{t.commB}</b>{t.commC}
        </p>
      </div>
    </section>
  );
}
