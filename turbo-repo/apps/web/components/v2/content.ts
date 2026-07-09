// Contenido de la landing v2. Fuente ES aquí; en/pt en content.en.ts / content.pt.ts.
// getContent(lang) resuelve el diccionario por idioma (fallback a es).
// Identidad: la landing ModularIoT original (alpha-2506). Infraestructura de
// navegación/página de precios guiada por clickhouse.com. We Got You y la
// calculadora del portafolio de costos alimentan secciones específicas.

import { en } from "./content.en";
import { pt } from "./content.pt";

export const content = {
  // Nav calcado de clickhouse.com: header oscuro translúcido; "Producto" es un
  // mega-menú con items ricos (icono + título + descripción) agrupados en
  // secciones; "Soluciones" y "Recursos" son paneles de columnas con encabezado
  // y link "Todos →"; Docs/Precios/Contacto son links directos; a la derecha
  // badge GitHub, selector de idioma y CTA amarillo.
  nav: {
    mega: {
      label: "Producto",
      sections: [
        {
          title: "Plataforma",
          items: [
            { icon: "signal", label: "Ingesta GPS Core", href: "/producto/ingesta-gps-core", desc: "Pipeline de señales GPS y sensores en tiempo real" },
            { icon: "radar", label: "Síntomas / Torre de Control", href: "/producto/sintomas-torre-control", desc: "30+ reglas de detección con trazabilidad" },
            { icon: "plug", label: "Integraciones", href: "/producto/integraciones", desc: "Workflows, webhooks y bóveda de evidencia" },
            { icon: "video", label: "Video en Vivo / HLS", href: "/producto/video-en-vivo", desc: "Streaming continuo desde cámaras y dashcams" },
          ],
        },
        {
          title: "Tecnología",
          items: [
            { icon: "code", label: "Características", href: "/producto/caracteristicas", desc: "Streaming, alertas y flujos de trabajo" },
            { icon: "stack", label: "Arquitectura", href: "/producto/arquitectura", desc: "Del dispositivo edge a tu nube en <56ms" },
            { icon: "cloud", label: "Implementación", href: "/producto/implementacion", desc: "Tu nube, gestionado por MBL o edge híbrido" },
          ],
        },
        {
          title: "Explóralo en vivo · datos reales",
          items: [
            { icon: "radar", label: "Torre de control", href: "/torre", desc: "Los 36 síntomas sobre una operación real" },
            { icon: "stack", label: "SuperProfile", href: "/superprofile", desc: "La identidad operacional viva de cada actor" },
            { icon: "plug", label: "Canales de escalamiento", href: "/canales", desc: "La alerta en correo, WhatsApp, Teams, Webex y SMS" },
            { icon: "signal", label: "Proveedores GPS", href: "/proveedores-gps", desc: "Precisión de señal: 12/20 pulsos por minuto" },
          ],
        },
      ],
    },
    columnMenus: [
      {
        label: "Soluciones",
        columns: [
          {
            title: "Casos de uso",
            links: [
              { label: "Monitoreo de conductores y activos", href: "/soluciones#casos-de-uso" },
              { label: "Telemetría mecánica y mantenimiento", href: "/soluciones#casos-de-uso" },
              { label: "Cumplimiento y auditorías", href: "/soluciones#casos-de-uso" },
              { label: "Torre de control operacional", href: "/soluciones#casos-de-uso" },
            ],
            footer: { label: "Todas las soluciones", href: "/soluciones" },
          },
          {
            title: "Industrias",
            links: [
              { label: "Transporte de carga", href: "/soluciones#industrias" },
              { label: "Minería", href: "/soluciones#industrias" },
              { label: "Distribución y última milla", href: "/soluciones#industrias" },
              { label: "Logística industrial", href: "/soluciones#industrias" },
            ],
            footer: { label: "Casos reales", href: "/#clientes" },
          },
        ],
      },
      {
        label: "Recursos",
        columns: [
          {
            title: "Aprende",
            links: [
              { label: "Documentación", href: "https://docs.modulariot.com", external: true },
              { label: "Casos reales", href: "/#clientes" },
              { label: "Preguntas frecuentes", href: "/#faq" },
            ],
            footer: { label: "Todos los recursos", href: "/recursos" },
          },
          {
            title: "Comunidad",
            links: [
              { label: "GitHub", href: "https://github.com/microboxlabs", external: true },
              { label: "MicroBox Labs", href: "https://microboxlabs.com", external: true },
            ],
          },
        ],
      },
    ],
    direct: [
      { label: "Docs", href: "https://docs.modulariot.com", external: true },
      { label: "Precios", href: "/precios" },
      { label: "Contacto", href: "/contacto" },
    ],
    github: { label: "GitHub", href: "https://github.com/microboxlabs" },
    languages: [
      { code: "es", label: "Español" },
      { code: "en", label: "English" },
      { code: "pt", label: "Português" },
    ],
    cta: "Solicitar demo",
  },

  hero: {
    kicker: "Código Abierto · Apache-2.0",
    titlePre: "De detectar desviaciones a ",
    titleHighlight: "reducirlas",
    titlePost: ", en tu operación real.",
    subtitle:
      "No vendemos más alertas: convertimos cada señal en menos problemas repetidos. Y los datos y las decisiones son tuyos.",
    ctaPrimary: "Agenda demo técnico de 20 min",
    ctaSecondary: "Ver precios",
    terminalTitle: "modulariot — flujo en vivo",
    terminalLines: [
      { time: "14:02:11", tag: "INGESTA", text: "2,847 señales GPS/s · latencia p50 42ms" },
      { time: "14:02:36", tag: "SINTOMA", text: "Exceso de velocidad · Ruta interna A2 · severidad alta" },
      { time: "14:02:37", tag: "WORKFLOW", text: "Evento #48210 → SMS supervisor + evidencia capturada" },
      { time: "14:02:39", tag: "SINK", text: "asset_data ← 2,847 filas · tu PostgreSQL, tu nube" },
    ],
  },

  stats: {
    title: "Una operación real, corriendo hoy — no una demo",
    items: [
      { value: "55.847", label: "síntomas gestionados en un mes real" },
      { value: "65%", label: "de las alertas tratadas se invalidan: cerrar ≠ resolver" },
      { value: "+28", label: "proveedores GPS integrados" },
      { value: "1.900+", label: "activos en operación real" },
    ],
  },

  // Sección de problema (alimentada por We Got You): el conflicto emocional que
  // engancha antes de presentar la solución.
  problem: {
    kicker: "El problema",
    title: "Tratas cada alerta. Las desviaciones vuelven igual.",
    subtitle:
      "Casi todo se atiende: el 97% de los síntomas recibe tratamiento. Pero la mayoría se invalida — se cierra el ticket, no se resuelve la causa. Por eso las mismas desviaciones se repiten mes a mes.",
    pains: [
      {
        title: "“Me avisaron al día siguiente”",
        body: "El evento ya había ocurrido. El sistema lo registró todo. Pero nadie lo vio hasta que fue demasiado tarde para actuar.",
      },
      {
        title: "“Tenemos alertas, pero son ruido”",
        body: "El sistema dispara cientos de notificaciones al día. El equipo las ignora. Las críticas se pierden entre las irrelevantes.",
      },
      {
        title: "“No podemos probar nada”",
        body: "Cuando llega una auditoría, una fiscalización o un reclamo, reconstruir lo que ocurrió es un trabajo de días. Si es que los datos existen.",
      },
    ],
  },

  // Demostración paso a paso (estilo luuk.cl): el pipeline real convertido en una
  // historia de 5 pasos, de la señal cruda a la evidencia auditable.
  steps: {
    kicker: "Cómo funciona en la práctica",
    title: "De una señal cruda a una decisión, en menos de un segundo",
    subtitle: "El mismo evento que ves en el flujo en vivo, contado paso a paso.",
    items: [
      {
        n: "01",
        title: "Se captura la señal",
        body: "Cada ping GPS, valor de sensor y evento del conductor entra a tu flujo en milisegundos, sin importar el proveedor del hardware.",
        tag: "INGESTA",
      },
      {
        n: "02",
        title: "Se procesa en tiempo real",
        body: "El motor de streaming enriquece y evalúa la señal contra más de 30 reglas, con latencia mediana bajo 56 ms.",
        tag: "STREAM",
      },
      {
        n: "03",
        title: "Se detecta el síntoma",
        body: "Si algo se desvía del estándar de tu operación, se genera un evento clasificado por severidad — no una notificación genérica más.",
        tag: "SÍNTOMA",
      },
      {
        n: "04",
        title: "Se activa la respuesta",
        body: "El evento se asigna a un responsable y dispara el flujo que definiste: SMS, alerta en el panel, orden de trabajo o webhook.",
        tag: "WORKFLOW",
      },
      {
        n: "05",
        title: "Queda la evidencia",
        body: "Todo se registra con timestamp, responsable y resolución en tu propia base de datos. Auditoría lista en segundos, no en días.",
        tag: "EVIDENCIA",
      },
    ],
  },

  painOutcome: {
    kicker: "El cambio de fondo",
    title: "La diferencia entre alertar y reducir",
    left: {
      title: "Solo alertar",
      items: [
        "La bandeja se llena de notificaciones que el equipo termina ignorando",
        "Se cierra el ticket, pero la causa que lo genera sigue ahí",
        "Las mismas desviaciones se repiten mes a mes",
        "Nadie sabe si la gestión de verdad redujo el problema",
        "El dato queda atrapado en un sistema de terceros",
      ],
    },
    right: {
      title: "Con ModularIoT",
      items: [
        "Cada síntoma llega con responsable, contexto y plan de acción",
        "Atacamos la causa raíz, no solo el evento del día",
        "Medimos la reducción real de desviaciones mes a mes",
        "El SuperProfile muestra si cada actor mejora o reincide",
        "Los datos y las decisiones quedan bajo tu control",
      ],
    },
  },

  features: {
    kicker: "Características",
    title: "Tres capacidades principales",
    subtitle: "Todo lo que necesitas para procesar, analizar y actuar sobre datos de flota en tiempo real",
    cards: [
      {
        title: "Pipeline de transmisión en tiempo real",
        code: `// Transmisión de datos GPS y sensores
const pipeline = new StreamProcessor({
  source: 'fleet-telemetry',
  processors: [
    new GPSProcessor(),
    new SensorProcessor(),
    new EventProcessor()
  ],
  sink: 'your-cloud-storage',
  latency: '< 56ms'
});

pipeline.start();
// Stream activo: 10K+ eventos/seg`,
      },
      {
        title: "Alertas basadas en síntomas",
        code: `// Reglas de alerta inteligentes
const alertRules = {
  driverFatigue: {
    triggers: ['eye_closure > 3s',
               'lane_deviation > 2'],
    actions: ['sms_supervisor',
              'audio_alert'],
    priority: 'critical'
  }
};

AlertManager.configure(alertRules);
// 32% menos incidentes en 2 semanas`,
      },
      {
        title: "Escalamiento según el síntoma",
        code: `// Escalamiento por síntoma
const escalamiento = new Escalation({
  onSymptom: 'código negro',
  notify: ['email', 'whatsapp', 'teams'],
  conversation: true,   // ciclo bidireccional
  owner: 'jefe_operaciones'
});
// Cada alerta llega con plan y dueño`,
      },
    ],
  },

  architecture: {
    kicker: "Arquitectura",
    title: "Del dispositivo edge a tu infraestructura",
    subtitle: "Ve cómo fluyen tus datos desde dispositivos edge hasta tu nube en tiempo real",
    steps: [
      { n: "01", title: "Ingesta de datos", body: "Recopila datos GPS, sensores y eventos de tu flota en tiempo real" },
      { n: "02", title: "Procesamiento de streams", body: "Procesa y analiza flujos de datos con latencia subsegundo" },
      { n: "03", title: "Tu infraestructura", body: "Los datos fluyen directamente a tu base de datos, analítica y aplicaciones" },
    ],
    latency: "< 56 ms latencia mediana extremo a extremo",
    latencySubtitle: "Desde lectura del sensor hasta respuesta de tu aplicación",
  },

  useCases: {
    kicker: "Casos de uso",
    title: "Cuatro cajas de procesamiento. Contratas solo las que necesitas.",
    subtitle:
      "Arquitectura modular sin dependencia de proveedor: cada caja es un servicio independiente con precio propio por activo.",
    cards: [
      {
        id: "ingesta",
        icon: "signal",
        title: "Ingesta GPS Core",
        body: "Cada ping GPS, señal de sensor y evento del conductor fluye a tus sistemas en milisegundos. API de última señal, tracking AVL y captura de cambios hacia tus sistemas.",
        bullets: ["API de última señal por activo", "Tracking AVL en tiempo real", "CDC hacia tus sistemas downstream"],
      },
      {
        id: "sintomas",
        icon: "radar",
        title: "Síntomas / Torre de Control",
        body: "Más de 30 reglas de detección: velocidad por tramo, conducción continua, zonas de riesgo, fatiga, telemetría mecánica. Cada evento con severidad, responsable y trazabilidad completa.",
        bullets: ["Severidad y responsable automáticos", "Ciclo de vida: abrir → tratar → cerrar", "Exclusión inteligente de ruido"],
      },
      {
        id: "integraciones",
        icon: "plug",
        title: "Integraciones",
        body: "Automatización de flujos con n8n, gestor documental para evidencia, API gateway y webhooks. Tu operación conectada con los sistemas que ya usas.",
        bullets: ["Workflows y webhooks (n8n)", "Bóveda de evidencia documental", "APIs y gateway para tus sistemas"],
      },
      {
        id: "video",
        icon: "video",
        title: "Video en Vivo / HLS",
        body: "Streams de video continuos de 24 horas desde las cámaras a bordo de tus activos. Contexto visual para cada evento detectado.",
        bullets: ["Streaming HLS 24h continuo", "Frames desde cámaras y dashcams", "Contexto visual de cada alerta"],
      },
    ],
  },

  // Feed We Got You: casos reales y quotes como social proof.
  stories: {
    kicker: "Clientes",
    title: "Operaciones que dejaron de enterarse tarde",
    metrics: [
      { value: "+1.900", label: "activos en operación real" },
      { value: "97%", label: "de síntomas con gestión" },
      { value: "36", label: "reglas de detección en producción" },
      { value: "5", label: "canales de escalamiento" },
    ],
    cases: [
      {
        tag: "Transporte y Minería",
        before:
          "Empresa con flota propia en operación minera. Sin evidencia de excesos de velocidad en rutas internas. Auditorías que tomaban días.",
        after:
          "Detección de excesos de velocidad con severidad automática desde el primer mes. Límites por tramo interno, más restrictivos que el mapa oficial. Evidencia lista para cualquier fiscalización, en segundos.",
      },
      {
        tag: "Flota de Distribución",
        before:
          "Flota de 390 vehículos livianos. Vehículos quedando varados en ruta sin previo aviso. Sin datos del estado mecánico hasta que el conductor llamaba al jefe.",
        after:
          "Telemetría mecánica activa en toda la flota. Check Engine, batería límite y falla de alternador detectados antes de la detención.",
      },
    ],
    quotes: [
      {
        text: "Ahora cuando pasa algo, lo primero que hace mi equipo es abrir el sistema y buscar el evento. Antes llamaban al conductor.",
        author: "Jefe de Operaciones, Empresa de Transporte de Carga, Chile",
      },
      {
        text: "Tenía GPS en todos mis vehículos. El camión pasó por zona de riesgo de noche y nadie me avisó. Me enteré al día siguiente. Eso ya no ocurre.",
        author: "Gerente de Flota, Empresa Logística, Norte de Chile",
      },
    ],
  },

  deployment: {
    kicker: "Implementación",
    title: "Opciones de implementación",
    subtitle: "Elige el modelo que mejor se adapte a tus requisitos y necesidades de cumplimiento",
    options: [
      {
        title: "SaaS · gestionado por MBL",
        highlight: "Más popular",
        description: "Nosotros operamos la infraestructura en la nube; tú te enfocas en la operación. La puesta en marcha más rápida.",
        features: ["Cero overhead de DevOps", "Monitoreo y soporte", "Actualizaciones automáticas", "Garantías SLA"],
      },
      {
        title: "En tu nube",
        highlight: "Soberanía de datos",
        description: "Se despliega en tu propia infraestructura (AWS, Azure o GCP). Los datos nunca salen de tu control.",
        features: ["Soberanía completa de datos", "Políticas de seguridad propias", "Escalado ilimitado", "Acceso directo a base de datos"],
      },
      {
        title: "On-premise · edge",
        highlight: "En tus instalaciones",
        description: "Procesamiento en tus instalaciones para baja latencia, con respaldo y analítica en nube.",
        features: ["Procesamiento edge de baja latencia", "Capacidad offline", "Sincronización con la nube", "Cumplimiento regional"],
      },
    ],
  },

  pricingTeaser: {
    kicker: "Precios",
    title: "Paga por activo, solo por lo que usas",
    subtitle:
      "Sin licencias por asiento, sin costos de instalación. Cada caja de procesamiento tiene precio propio por activo/mes. Arma tu plan con la calculadora.",
    cta: "Calcula el precio de tu flota",
  },

  faq: {
    kicker: "FAQ",
    title: "Preguntas frecuentes",
    items: [
      {
        q: "¿Cuál es la diferencia entre ModularIoT y los proveedores tradicionales de telemática?",
        a: "Los proveedores tradicionales se quedan en alertar: te notifican y ahí termina. ModularIoT interpreta cada síntoma, asigna responsable y plan, y mide si la desviación de verdad baja mes a mes. Además los datos y la lógica de procesamiento quedan bajo tu control, sin encierro en tarifas por activo. Es la diferencia entre alertar y reducir.",
      },
      {
        q: "¿Cómo se compara ModularIoT con Apache Kafka o Apache Pulsar?",
        a: "Kafka y Pulsar son excelentes brokers de mensajes; ModularIoT es una plataforma completa de procesamiento de datos de flota. Usamos Pulsar bajo el capó, pero agregamos procesadores específicos para flotas, reglas de detección e integraciones listas para usar. Streaming de nivel empresarial sin construir todo desde cero.",
      },
      {
        q: "¿Necesito cambiar mi tecnología actual?",
        a: "No. Nos integramos con los sensores, GPS, cámaras y sistemas que ya tienes instalados. En el diagnóstico revisamos tu tecnología actual y confirmamos la compatibilidad.",
      },
      {
        q: "¿Qué pasa con GDPR y la soberanía de datos?",
        a: "La soberanía de datos es un principio fundamental: todo el procesamiento ocurre en tu región/nube elegida y nunca almacenamos los datos de tu flota en nuestros sistemas. Incluimos anonimización, políticas de retención y rastros de auditoría. Tus datos permanecen bajo tu control en todo momento.",
      },
      {
        q: "¿Qué tan rápido podemos comenzar?",
        a: "Para implementaciones gestionadas, puedes estar procesando datos en vivo en 48 horas. Las implementaciones en tu nube típicamente toman 1-2 semanas incluyendo configuración de infraestructura y pruebas de integración.",
      },
      {
        q: "¿El sistema genera muchas alertas que el equipo termina ignorando?",
        a: "Es exactamente lo que evitamos. Las alertas tienen reglas de exclusión inteligente: no se genera una notificación si no cumple las condiciones configuradas para tu operación. Tus operadores ven solo lo que importa y requiere acción.",
      },
      {
        q: "¿Qué tipo de soporte ofrecen?",
        a: "Todos los planes incluyen soporte técnico a través de nuestro portal. Los planes superiores incluyen Customer Success Manager dedicado y tiempos de respuesta prioritarios, hasta soporte 24/7 con SLAs garantizados.",
      },
    ],
  },

  finalCta: {
    title: "¿Listo para reducir las desviaciones de tu operación?",
    body: "No más alertas que se acumulan. Convierte cada señal en menos problemas repetidos — con tus datos y tus decisiones bajo tu control. Míralo funcionando en 20 minutos.",
    cta: "Agendar llamada de integración",
    note: "Sin compromiso · Respuesta en menos de 24 horas",
    stats: [
      { value: "48hr", label: "configuración de implementación gestionada" },
      { value: "0%", label: "dependencia de proveedores de datos" },
      { value: "100%", label: "tus datos, tu control" },
    ],
  },

  footer: {
    description: "Convertimos cada señal de tu flota en menos desviaciones repetidas. Los datos y las decisiones son tuyos.",
    columns: [
      {
        title: "Explorar",
        links: [
          { label: "Torre de control", href: "/torre" },
          { label: "SuperProfile", href: "/superprofile" },
          { label: "Canales de escalamiento", href: "/canales" },
          { label: "Proveedores GPS", href: "/proveedores-gps" },
          { label: "Precios", href: "/precios" },
        ],
      },
      {
        title: "Documentación",
        links: [
          { label: "Inicio rápido", href: "https://docs.modulariot.com" },
          { label: "Referencia API", href: "https://docs.modulariot.com" },
          { label: "Integraciones", href: "https://docs.modulariot.com" },
          { label: "GitHub", href: "https://github.com/microboxlabs" },
        ],
      },
      {
        title: "Empresa",
        links: [
          { label: "Acerca de MicroBox Labs", href: "https://microboxlabs.com" },
          { label: "Contacto", href: "/contacto" },
        ],
      },
    ],
    copyright: `© ${new Date().getFullYear()} MicroBox Labs · Todos los derechos reservados`,
  },

  // Página /precios — infraestructura tipo clickhouse.com/pricing:
  // header → filosofía → calculadora → FAQ de precios → CTA.
  pricingPage: {
    title: "Precios",
    subtitle:
      "Paga basado en uso, no por licencias por asiento. Cada caja de procesamiento tiene precio propio por activo/mes y escala conforme crece tu flota.",
    philosophy: [
      {
        title: "Paga solo por lo que usas",
        body: "Contratas cajas de procesamiento independientes. Si no usas video o integraciones, no las pagas.",
      },
      {
        title: "Precio por activo, transparente",
        body: "Un precio fijo por activo/mes por cada caja. Sin sorpresas, sin costos de instalación, sin permanencia mínima.",
      },
      {
        title: "Basado en costos reales",
        body: "Los precios derivan del costo real de infraestructura por transacción de la plataforma, no de una tarifa arbitraria.",
      },
    ],
    faqTitle: "Preguntas sobre precios",
    faqs: [
      {
        q: "¿Cómo se cobra el servicio?",
        a: "Suscripción mensual por activo monitoreado, según las cajas de procesamiento que contrates. La propuesta final se entrega después del diagnóstico gratuito.",
      },
      {
        q: "¿Los precios de la calculadora son finales?",
        a: "Son referenciales, basados en costos reales de infraestructura. La propuesta formal puede variar según volumen, configuración de reglas y modelo de implementación (tu nube, gestionado o edge híbrido).",
      },
      {
        q: "¿Hay costos de instalación o permanencia mínima?",
        a: "No. La integración con tu tecnología actual está incluida y puedes ajustar o cancelar las cajas contratadas mes a mes.",
      },
      {
        q: "¿Qué incluye cada caja?",
        a: "Cada caja es un servicio completo: infraestructura, procesamiento, panel de gestión y soporte. La caja de Ingesta GPS Core es la base sobre la que operan las demás.",
      },
    ],
    cta: {
      title: "¿Tu caso es más complejo?",
      body: "Flotas grandes, múltiples operaciones o requisitos de cumplimiento específicos: conversemos y armamos una propuesta a medida.",
      button: "Hablar con nosotros",
    },
  },
};

export type Content = typeof content;

// Diccionarios por idioma. en/pt se castean a Content (misma forma, strings distintos).
export const dictionaries = {
  es: content,
  en: en as unknown as Content,
  pt: pt as unknown as Content,
};

export function getContent(lang?: string): Content {
  return (lang && (dictionaries as Record<string, Content>)[lang]) || content;
}
