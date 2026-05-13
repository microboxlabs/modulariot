// i18n.jsx — strings + useT() hook
const STRINGS = {
  en: {
    promo: { tag: "v0.9 Alpha", text: "Modular IoT joins the CNCF Sandbox sandbox track", cta: "Read the announcement →" },
    nav: { features: "Features", architecture: "Architecture", showcase: "Live", quickstart: "Quick start", community: "Community", docs: "Docs" },
    cta: { demo: "Book a 20-min demo", repo: "View on GitHub", arch: "Read architecture guide", live: "See it running" },
    hero: {
      eyebrow: "Open-source · Apache-2.0",
      title: ["Real-time signals,", "operational understanding."],
      titleAccent: "operational understanding.",
      lede: "Modular IoT turns raw telemetry into living symptoms — then into coordinated action. Open-source, composable, and deployed in your cloud.",
      meta: ["Live since 2024", "23 active deployments", "Built from real fleet operations"]
    },
    marquee: { label: "Built for logistics, fleet operations, mining and industrial telemetry" },
    symptom: {
      eyebrow: "The conceptual heart",
      title: "From signals to symptoms to action",
      lede: "Most platforms stop at alerts. Modular IoT models a five-stage lifecycle that gives operations a vocabulary for what is actually happening — and a record of what was done about it.",
      steps: [
        { eyebrow: "01 · Capture", title: "Signals", body: "Raw telemetry: GPS pings, sensor reads, driver events. High volume, noisy, inert.", rows: ["gps.lat 23.6438", "speed 87 km/h", "rpm 2840", "temp.engine 91°C", "accel −0.42 g"] },
        { eyebrow: "02 · Stream", title: "Behaviors", body: "Patterns derived in motion: trends, anomalies, sequences. Still neutral, not yet meaning.", rows: ["braking.harsh × 3", "speed.over_limit", "lane.deviation", "geofence.near_exit"] },
        { eyebrow: "03 · Identify", title: "Symptoms", body: "Stateful operational concepts. They have severity, evolve, can be treated, audited.", rows: ["Driver fatigue · open · sev 2", "Geofence exit · open · sev 3", "Engine overheat · watch"] },
        { eyebrow: "04 · Orchestrate", title: "Treatments", body: "Workflows triggered by symptoms — dispatch, escalations, holds, contact attempts.", rows: ["sms → supervisor", "task → control tower", "trip.hold pending ack", "audio → cabin"] },
        { eyebrow: "05 · Audit", title: "Evidence", body: "Every signal, decision and action persists. A defensible operational record.", rows: ["incident #4821 · resolved", "ack by O. Mendoza · 14:32", "trail · 312 events", "compliance: ISO 39001"] }
      ],
      footnote: "A symptom is not just an alert — it has state, severity, owners, and outcomes."
    },
    bento: {
      eyebrow: "Primitives",
      title: "Replaceable components around a consistent operational model",
      lede: "The architecture stays stable even as the stack evolves. Bring your own ingest, your own storage, your own orchestrator.",
      cards: [
        { title: "Symptom Intelligence", body: "Stateful operational concepts with severity, ownership, evolution and treatment — the layer above alerts.", tag: "Core" },
        { title: "Real-time ingestion", body: "MQTT, REST, gRPC, batch. Provider-agnostic. Sub-second to first behavior.", tag: "I/O" },
        { title: "Orchestration", body: "Trigger workflows from symptoms. n8n, BPMN, or your own engine — pluggable.", tag: "Workflow" },
        { title: "Live dashboards", body: "Map, kanban, timeline, control-tower. Built for operators, not analysts.", tag: "UI" },
        { title: "Evidence vault", body: "Append-only operational record. Audit, compliance, replay, hand-off.", tag: "Storage" },
        { title: "Open-source · BYO cloud", body: "Apache-2.0. Deploy to AWS, GCP, Azure or on-prem. You own the data.", tag: "OSS" },
      ]
    },
    framework: {
      title: "Use Modular IoT with any hardware and any cloud",
      lede: "Composable by design. Swap components without rewriting your operational model.",
      items: [
        { label: "MQTT", kind: "protocol" },
        { label: "REST", kind: "protocol" },
        { label: "Pulsar", kind: "stream" },
        { label: "Kafka", kind: "stream" },
        { label: "Postgres", kind: "store" },
        { label: "n8n", kind: "workflow" },
        { label: "AWS · GCP · Azure", kind: "cloud" },
        { label: "On-prem · Air-gap", kind: "cloud" },
      ]
    },
    showcase: {
      eyebrow: "Operator experience",
      title: "Built for the people who run operations",
      lede: "Map, kanban, symptom timeline. Designed for radio-dispatch density, not analyst dashboards.",
      bullets: [
        { t: "Status-first density", d: "Pendiente, En curso, Aprobada, Rechazada — sentence-case, never ambiguous." },
        { t: "Symptom-aware kanban", d: "Cards pulse rose when a symptom escalates. The board is the truth." },
        { t: "Map · Timeline · Evidence", d: "Three views, one model. Every action leaves a trace." },
        { t: "Bilingual operator copy", d: "Spanish-first, English-mirrored. Domain vocabulary stays in source language." }
      ]
    },
    quickstart: {
      eyebrow: "Quick start",
      title: "Start monitoring in minutes",
      lede: "Templates and reference deployments to skip the integration grind.",
      cards: [
        { icon: "helm", title: "Helm chart · Kubernetes", body: "Deploy the full platform — broker, processor, dashboards — to any K8s cluster.", meta: "modulariot/helm · v0.9.2" },
        { icon: "n8n", title: "n8n workflow templates", body: "12 ready-made flows: dispatch escalation, ETA recalculation, fatigue protocol.", meta: "templates/n8n · 12 flows" },
        { icon: "api", title: "Symptom API examples", body: "REST + WebSocket clients in TypeScript, Python, Go. Define and observe symptoms.", meta: "examples/symptom-api · 3 langs" }
      ]
    },
    community: {
      eyebrow: "Community",
      title: "Open-source. Built in public.",
      lede: "Modular IoT is developed openly under Apache-2.0. Roadmap, issues and RFCs live on GitHub.",
      cta: "Star modulariot/modulariot",
      items: [
        { stat: "2.4k", label: "GitHub stars" },
        { stat: "143", label: "Contributors" },
        { stat: "23", label: "Production deployments" }
      ]
    },
    final: {
      title: "See it running.",
      lede: "20 minutes with our team. We bring a live deployment, you bring your hardest fleet question.",
    },
    foot: {
      tag: "Real-time operational intelligence. Open-source. Yours to run.",
      product: ["Features", "Architecture", "Symptom model", "Roadmap", "Changelog"],
      developers: ["Documentation", "API reference", "GitHub", "Examples", "Status"],
      company: ["About MicroboxLabs", "Customers", "Blog", "Press", "Careers"],
      resources: ["Architecture guide", "Security", "Privacy", "Terms", "Contact"]
    }
  },
  es: {
    promo: { tag: "v0.9 Alpha", text: "Modular IoT se suma al CNCF Sandbox", cta: "Lee el anuncio →" },
    nav: { features: "Producto", architecture: "Arquitectura", showcase: "En vivo", quickstart: "Quick start", community: "Comunidad", docs: "Docs" },
    cta: { demo: "Agenda demo de 20 min", repo: "Ver en GitHub", arch: "Lee la guía de arquitectura", live: "Ver en vivo" },
    hero: {
      eyebrow: "Open-source · Apache-2.0",
      title: ["Señales en tiempo real,", "entendimiento operacional."],
      titleAccent: "entendimiento operacional.",
      lede: "Modular IoT transforma la telemetría cruda en síntomas vivos — y los síntomas en acción coordinada. Open-source, composable, desplegado en tu cloud.",
      meta: ["Activo desde 2024", "23 despliegues productivos", "Nacido de operaciones reales"]
    },
    marquee: { label: "Hecho para logística, flotas, minería y telemetría industrial" },
    symptom: {
      eyebrow: "El corazón conceptual",
      title: "De señales a síntomas a acción",
      lede: "La mayoría de las plataformas se queda en alertas. Modular IoT modela un ciclo de cinco etapas que le da a operaciones un vocabulario para lo que está pasando — y un registro de lo que se hizo al respecto.",
      steps: [
        { eyebrow: "01 · Captura", title: "Señales", body: "Telemetría cruda: pings GPS, lecturas de sensores, eventos del conductor. Alto volumen, ruido, inercia.", rows: ["gps.lat 23.6438", "speed 87 km/h", "rpm 2840", "temp.engine 91°C", "accel −0.42 g"] },
        { eyebrow: "02 · Stream", title: "Comportamientos", body: "Patrones derivados en movimiento: tendencias, anomalías, secuencias. Aún neutros, sin significado.", rows: ["braking.harsh × 3", "speed.over_limit", "lane.deviation", "geofence.near_exit"] },
        { eyebrow: "03 · Identifica", title: "Síntomas", body: "Conceptos operacionales con estado. Tienen severidad, evolucionan, se tratan, se auditan.", rows: ["Fatiga conductor · abierto · sev 2", "Salida geocerca · abierto · sev 3", "Sobrecalent. motor · vigilar"] },
        { eyebrow: "04 · Orquesta", title: "Tratamientos", body: "Workflows disparados por síntomas — despacho, escalamientos, hold, contacto.", rows: ["sms → supervisor", "tarea → torre control", "viaje.hold pendiente ack", "audio → cabina"] },
        { eyebrow: "05 · Audita", title: "Evidencia", body: "Cada señal, decisión y acción persiste. Un registro operacional defendible.", rows: ["incidente #4821 · resuelto", "ack por O. Mendoza · 14:32", "rastro · 312 eventos", "cumple: ISO 39001"] }
      ],
      footnote: "Un síntoma no es solo una alerta — tiene estado, severidad, dueños y resultados."
    },
    bento: {
      eyebrow: "Primitivas",
      title: "Componentes reemplazables sobre un modelo operacional consistente",
      lede: "La arquitectura se mantiene estable aunque cambie el stack. Trae tu ingesta, tu storage, tu orquestador.",
      cards: [
        { title: "Symptom Intelligence", body: "Conceptos operacionales con estado, severidad, dueño, evolución y tratamiento — la capa sobre las alertas.", tag: "Core" },
        { title: "Ingesta en tiempo real", body: "MQTT, REST, gRPC, batch. Agnóstico de proveedor. Subsegundo al primer comportamiento.", tag: "I/O" },
        { title: "Orquestación", body: "Dispara workflows desde síntomas. n8n, BPMN, o tu motor — pluggable.", tag: "Workflow" },
        { title: "Dashboards en vivo", body: "Mapa, kanban, timeline, torre de control. Para operadores, no analistas.", tag: "UI" },
        { title: "Bóveda de evidencia", body: "Registro append-only. Auditoría, cumplimiento, replay, traspaso de turno.", tag: "Storage" },
        { title: "Open-source · BYO cloud", body: "Apache-2.0. Desplegable en AWS, GCP, Azure u on-prem. Tú eres dueño de los datos.", tag: "OSS" },
      ]
    },
    framework: {
      title: "Usa Modular IoT con cualquier hardware y cualquier cloud",
      lede: "Composable por diseño. Cambia componentes sin reescribir tu modelo operacional.",
      items: [
        { label: "MQTT", kind: "protocol" }, { label: "REST", kind: "protocol" },
        { label: "Pulsar", kind: "stream" }, { label: "Kafka", kind: "stream" },
        { label: "Postgres", kind: "store" }, { label: "n8n", kind: "workflow" },
        { label: "AWS · GCP · Azure", kind: "cloud" }, { label: "On-prem · Air-gap", kind: "cloud" }
      ]
    },
    showcase: {
      eyebrow: "Experiencia del operador",
      title: "Hecho para quienes corren operaciones",
      lede: "Mapa, kanban, timeline de síntomas. Densidad de radio-despacho, no de dashboard analítico.",
      bullets: [
        { t: "Densidad orientada a estado", d: "Pendiente, En curso, Aprobada, Rechazada — sentence-case, nunca ambiguo." },
        { t: "Kanban con conciencia de síntomas", d: "Las tarjetas pulsan en rosa cuando un síntoma escala. El tablero es la verdad." },
        { t: "Mapa · Timeline · Evidencia", d: "Tres vistas, un modelo. Toda acción deja rastro." },
        { t: "Operador bilingüe", d: "Español primero, inglés espejo. El vocabulario de dominio se queda en su idioma." }
      ]
    },
    quickstart: {
      eyebrow: "Empieza rápido",
      title: "Monitorea en minutos",
      lede: "Templates y despliegues de referencia para saltarte la integración manual.",
      cards: [
        { icon: "helm", title: "Helm chart · Kubernetes", body: "Despliega la plataforma completa — broker, procesador, dashboards — en cualquier cluster K8s.", meta: "modulariot/helm · v0.9.2" },
        { icon: "n8n", title: "Templates de n8n", body: "12 flujos listos: escalamiento, recálculo de ETA, protocolo de fatiga.", meta: "templates/n8n · 12 flujos" },
        { icon: "api", title: "Ejemplos de Symptom API", body: "Clientes REST + WebSocket en TypeScript, Python, Go. Define y observa síntomas.", meta: "examples/symptom-api · 3 langs" }
      ]
    },
    community: {
      eyebrow: "Comunidad",
      title: "Open-source. Construido en público.",
      lede: "Modular IoT se desarrolla abiertamente bajo Apache-2.0. Roadmap, issues y RFCs viven en GitHub.",
      cta: "Dale star a modulariot/modulariot",
      items: [
        { stat: "2.4k", label: "Stars en GitHub" },
        { stat: "143", label: "Contribuyentes" },
        { stat: "23", label: "Despliegues productivos" }
      ]
    },
    final: {
      title: "Míralo funcionando.",
      lede: "20 minutos con nuestro equipo. Nosotros traemos un despliegue en vivo, tú traes tu pregunta de flota más difícil.",
    },
    foot: {
      tag: "Inteligencia operacional en tiempo real. Open-source. Tuya para correr.",
      product: ["Producto", "Arquitectura", "Modelo de síntomas", "Roadmap", "Changelog"],
      developers: ["Documentación", "Referencia API", "GitHub", "Ejemplos", "Status"],
      company: ["Sobre MicroboxLabs", "Clientes", "Blog", "Prensa", "Carreras"],
      resources: ["Guía de arquitectura", "Seguridad", "Privacidad", "Términos", "Contacto"]
    }
  }
};

function useT(lang) {
  return STRINGS[lang] || STRINGS.en;
}

Object.assign(window, { STRINGS, useT });
