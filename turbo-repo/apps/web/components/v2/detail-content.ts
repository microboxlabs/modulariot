import type { DetailPageData } from "./DetailPage";
import { detailPagesEn } from "./detail-content.en";
import { detailPagesPt } from "./detail-content.pt";

// Contenido de las páginas de detalle. Clave = slug de ruta bajo /alpha-2506/{lang}/.
// ES aquí; en/pt en detail-content.en.ts / detail-content.pt.ts.
// getDetailPages(lang) resuelve el diccionario por idioma (fallback a es).

export const detailPages: Record<string, DetailPageData> = {
  // ===================== PRODUCTO · CAJAS =====================
  "producto/ingesta-gps-core": {
    eyebrow: "Producto · Ingesta GPS Core",
    icon: "signal",
    graphic: "ingesta",
    title: "Cada señal de tu flota, en tu nube, en milisegundos",
    subtitle:
      "La caja base de ModularIoT. Recibe cada ping GPS, valor de sensor y evento del conductor —sin importar el proveedor del hardware— y lo entrega a tu propia infraestructura en tiempo real.",
    blocks: [
      {
        type: "split",
        kicker: "Qué hace",
        title: "El pipeline sobre el que corre todo lo demás",
        body:
          "Ingesta GPS Core normaliza y transmite la telemetría cruda de tu flota hacia tus sistemas. Es la fundación: síntomas, integraciones y video se construyen sobre este flujo. Sin dependencia de proveedor y con los datos siempre bajo tu control.",
        bullets: [
          "API de última señal por activo (lastsignal)",
          "Tracking AVL en tiempo real",
          "Captura de cambios (CDC) hacia tus sistemas downstream",
          "Backbone de mensajería con Apache Pulsar",
          "Escritura directa a tu PostgreSQL / almacenamiento",
        ],
      },
      {
        type: "grid",
        kicker: "Capacidades",
        title: "Ingesta lista para producción",
        cards: [
          { icon: "signal", title: "Cualquier hardware", body: "Adaptadores universales para proveedores GPS (Redd, Samtech, GAMA y más). No cambias tus dispositivos." },
          { icon: "bolt", title: "Latencia < 56 ms", body: "De la lectura del sensor a tu aplicación, con procesamiento de stream de baja latencia." },
          { icon: "stack", title: "Alto volumen", body: "Diseñado para millones de señales al mes: 2.9M+ hoy en operación real, con margen para crecer." },
          { icon: "shield", title: "Tus datos, tu nube", body: "Los datos aterrizan en tu infraestructura. Soberanía completa, cumplimiento GDPR sin esfuerzo." },
          { icon: "plug", title: "CDC integrado", body: "Debezium captura cambios y los propaga a tus sistemas: sin polling, sin trabajos batch." },
          { icon: "code", title: "APIs abiertas", body: "REST y acceso directo a la base de datos para construir sobre el flujo lo que necesites." },
        ],
      },
      {
        type: "code",
        kicker: "Así se ve",
        title: "Configura el pipeline en minutos",
        cards: [
          {
            title: "Pipeline de ingesta",
            code: `const pipeline = new StreamProcessor({
  source: 'fleet-telemetry',
  processors: [
    new GPSProcessor(),
    new SensorProcessor(),
    new EventProcessor()
  ],
  sink: 'your-cloud-storage',
  latency: '< 56ms'
});

pipeline.start();`,
          },
          {
            title: "Última señal por activo",
            code: `GET /api/v1/lastsignal/{assetId}

{
  "assetId": "TRK-48210",
  "lat": -33.4489,
  "lng": -70.6693,
  "speed": 62,
  "ts": "2026-07-02T14:02:11Z",
  "source": "your-postgres"
}`,
          },
        ],
      },
    ],
  },

  "producto/sintomas-torre-control": {
    eyebrow: "Producto · Síntomas / Torre de Control",
    icon: "radar",
    graphic: "sintomas",
    title: "Más de 30 reglas que convierten datos en decisiones",
    subtitle:
      "No más datos crudos ni alertas de ruido. Cada señal se evalúa contra las reglas de tu operación y, si algo se desvía, se genera un evento clasificado por severidad, con responsable y trazabilidad completa.",
    blocks: [
      {
        type: "split",
        kicker: "Qué hace",
        title: "Interpreta, no solo registra",
        body:
          "La diferencia entre un GPS y ModularIoT es la misma que entre una cámara de seguridad y un guardia entrenado. La torre de control interpreta cada evento en su contexto operacional: ¿es zona de riesgo? ¿cuánto lleva activo? ¿quién debe atenderlo?",
        bullets: [
          "Severidad y responsable asignados automáticamente",
          "Ciclo de vida del evento: abrir → tratar → cerrar",
          "Exclusión inteligente de ruido: solo lo que requiere acción",
          "Umbrales y zonas configurados para tu operación",
          "Trazabilidad completa para auditorías",
        ],
      },
      {
        type: "grid",
        kicker: "Reglas de detección",
        title: "Una regla por cada riesgo que te importa",
        subtitle: "Más de 30 reglas activas en producción, cada una como microservicio independiente.",
        cards: [
          { icon: "radar", title: "Conducción", body: "Exceso de velocidad por tramo, conducción continua sin descanso, movimiento en horario no autorizado, doble conductor." },
          { icon: "shield", title: "Seguridad", body: "Botón de pánico (SOS), asistencia en ruta, uso de EPP, hombre-máquina, frenado y giro brusco, fatiga y somnolencia." },
          { icon: "truck", title: "Carga y activos", body: "Ausencia y deficiencia de amarre, sobrecalentamiento de motor, Check Engine, batería baja, falla de carga." },
          { icon: "signal", title: "Zonas y rutas", body: "Cruce en área no permitida, detención en zona de riesgo, pernoctación en zona no autorizada, desvío de ETA." },
        ],
      },
      {
        type: "steps",
        kicker: "Ciclo de vida",
        title: "El ciclo no termina en cerrar: termina en reducir",
        subtitle: "Cerrar el ticket no resuelve la causa. Por eso el ciclo agrega un paso más: reducir la recurrencia.",
        steps: [
          { n: "01", title: "Se detecta el síntoma", body: "La regla evalúa la señal en contexto y genera un evento con severidad." },
          { n: "02", title: "Se asigna un responsable", body: "El evento entra al panel de tu equipo operacional y se asigna para su gestión." },
          { n: "03", title: "Se trata", body: "El operador gestiona el evento con el contexto y la evidencia necesarios para actuar." },
          { n: "04", title: "Se cierra con trazabilidad", body: "Queda registrado con timestamp, responsable y resolución. Nada se pierde." },
          { n: "05", title: "Se reduce la recurrencia", body: "El SuperProfile agrega la historia por entidad y ataca la causa: menos eventos repetidos mes a mes, no solo tickets cerrados." },
        ],
      },
      {
        type: "linkgrid",
        kicker: "En vivo, con datos reales",
        title: "Explóralo sobre una operación real",
        subtitle: "Los mismos síntomas, corriendo sobre datos de junio 2026 — no una maqueta.",
        links: [
          { title: "Torre de control", body: "Los 36 síntomas, su historia y sus dashboards con datos reales.", href: "/torre" },
          { title: "SuperProfile", body: "El perfil vivo de cada transportista y conductor: nivel, riesgo y plan.", href: "/superprofile" },
          { title: "Canales de escalamiento", body: "La misma alerta en correo, WhatsApp, Teams, Webex y SMS.", href: "/canales" },
        ],
      },
    ],
  },

  "producto/integraciones": {
    eyebrow: "Producto · Integraciones",
    icon: "plug",
    graphic: "integraciones",
    title: "Tu operación conectada con lo que ya usas",
    subtitle:
      "Automatización de flujos, bóveda de evidencia documental, API gateway y webhooks. ModularIoT no reemplaza tus sistemas: los conecta y los potencia.",
    blocks: [
      {
        type: "split",
        kicker: "Qué hace",
        title: "Del evento a la acción, automáticamente",
        body:
          "Cuando se detecta un síntoma, no basta con verlo: hay que actuar. Integraciones dispara el flujo que definiste —notificar, crear una orden de trabajo, guardar evidencia, avisar a un sistema externo— sin intervención manual.",
        bullets: [
          "Workflows y webhooks con n8n",
          "Bóveda de evidencia documental (gestor ECM)",
          "API gateway para exponer y consumir servicios",
          "Servidor MCP para agentes de IA",
          "Automatización de GAMA, RFID y procesos a medida",
        ],
      },
      {
        type: "grid",
        kicker: "Conectores",
        title: "Integra con tu stack real",
        cards: [
          { icon: "plug", title: "n8n", body: "Orquesta flujos visuales: cuando pasa X, haz Y. Sin escribir código de integración." },
          { icon: "doc", title: "Bóveda de evidencia", body: "Cada evento queda con su documentación, lista para fiscalizaciones y auditorías." },
          { icon: "code", title: "API Gateway", body: "Expón tus servicios de forma segura y consume APIs de terceros desde un solo punto." },
          { icon: "stack", title: "Webhooks", body: "Notifica a cualquier sistema externo en tiempo real cuando ocurre un evento relevante." },
          { icon: "bolt", title: "Servidor MCP", body: "Conecta agentes de IA a tu operación para consultas y acciones asistidas." },
          { icon: "signal", title: "GAMA / RFID", body: "Ingesta de proveedores y validación de etiquetas RFID vía flujos automatizados." },
        ],
      },
    ],
  },

  "producto/video-en-vivo": {
    eyebrow: "Producto · Video en Vivo / HLS",
    icon: "video",
    graphic: "video",
    title: "Contexto visual para cada evento que detectas",
    subtitle:
      "Streams de video continuos de 24 horas desde las cámaras y dashcams a bordo de tus activos. Cuando un síntoma se dispara, no solo sabes qué pasó: puedes verlo.",
    blocks: [
      {
        type: "split",
        kicker: "Qué hace",
        title: "De frames de dispositivo a video en vivo",
        body:
          "El procesador de streams consume los frames de tus cámaras y genera streams HLS continuos con FFmpeg. Video rodante de 24 horas que da contexto visual a cada alerta, sin depender de un proveedor de videovigilancia externo.",
        bullets: [
          "Streaming HLS continuo de 24 horas",
          "Frames procesados desde cámaras y dashcams",
          "Contexto visual asociado a cada evento detectado",
          "Almacenamiento en tu propia infraestructura",
          "Verificación offline de frames y recuperación",
        ],
      },
      {
        type: "grid",
        kicker: "Capacidades",
        title: "Video operacional, no solo grabación",
        cards: [
          { icon: "video", title: "HLS 24h", body: "Streams rodantes continuos: siempre hay video disponible del período que necesitas revisar." },
          { icon: "bolt", title: "FFmpeg", body: "Procesamiento de frames a video con el estándar de la industria, en tu pipeline." },
          { icon: "radar", title: "Ligado a síntomas", body: "Cada evento de la torre de control puede enlazar el video del momento exacto." },
          { icon: "shield", title: "Tu almacenamiento", body: "Los frames y el video viven en tu bucket. Sin licencias de videovigilancia externa." },
        ],
      },
    ],
  },

  // ===================== PRODUCTO · TECNOLOGÍA =====================
  "producto/caracteristicas": {
    eyebrow: "Producto · Características",
    icon: "code",
    title: "Tres capacidades principales",
    subtitle:
      "Todo lo que necesitas para procesar, analizar y actuar sobre datos de flota en tiempo real, sobre una arquitectura abierta que controlas tú.",
    blocks: [
      {
        type: "code",
        kicker: "Streaming",
        title: "Pipeline de transmisión en tiempo real",
        subtitle: "Procesa cada señal a medida que llega, con latencia subsegundo.",
        cards: [
          {
            title: "StreamProcessor",
            code: `const pipeline = new StreamProcessor({
  source: 'fleet-telemetry',
  processors: [
    new GPSProcessor(),
    new SensorProcessor(),
    new EventProcessor()
  ],
  sink: 'your-cloud-storage',
  latency: '< 56ms'
});
pipeline.start();`,
          },
          {
            title: "Alertas por síntomas",
            code: `const alertRules = {
  driverFatigue: {
    triggers: ['eye_closure > 3s',
               'lane_deviation > 2'],
    actions: ['sms_supervisor'],
    priority: 'critical'
  }
};
AlertManager.configure(alertRules);`,
          },
        ],
      },
      {
        type: "grid",
        kicker: "Por qué importa",
        title: "Capacidades que se traducen en operación",
        cards: [
          { icon: "bolt", title: "Tiempo real", body: "Actúa mientras el evento ocurre, no al día siguiente. Latencia mediana bajo 56 ms." },
          { icon: "radar", title: "Detección inteligente", body: "Más de 30 reglas con exclusión de ruido: tu equipo ve solo lo que importa." },
          { icon: "doc", title: "Bóveda de evidencia", body: "Workflows automatizados con trazabilidad de 7 años, listos para cumplimiento." },
        ],
      },
    ],
  },

  "producto/arquitectura": {
    eyebrow: "Producto · Arquitectura",
    icon: "stack",
    title: "Del dispositivo edge a tu infraestructura",
    subtitle: "Ve cómo fluyen tus datos desde los dispositivos hasta tu nube en tiempo real, con latencia mediana extremo a extremo bajo 56 ms.",
    blocks: [
      {
        type: "steps",
        kicker: "El flujo",
        title: "Tres etapas, un pipeline",
        steps: [
          { n: "01", title: "Ingesta de datos", body: "Recopila datos GPS, sensores y eventos de tu flota en tiempo real, desde cualquier hardware." },
          { n: "02", title: "Procesamiento de streams", body: "Enriquece y evalúa flujos de datos con latencia subsegundo contra las reglas de tu operación." },
          { n: "03", title: "Tu infraestructura", body: "Los datos fluyen directamente a tu base de datos, analítica y aplicaciones. Tú eres el dueño." },
        ],
      },
      {
        type: "stats",
        items: [
          { value: "<56ms", label: "latencia mediana extremo a extremo" },
          { value: "2.9M+", label: "señales procesadas al mes" },
          { value: "99.9%", label: "precisión de procesamiento de eventos" },
          { value: "24/7", label: "operación continua" },
        ],
      },
      {
        type: "grid",
        kicker: "Principios de diseño",
        title: "Abierta, modular y tuya",
        cards: [
          { icon: "stack", title: "Modular", body: "Cada caja es un servicio independiente. Contratas y escalas solo lo que usas." },
          { icon: "shield", title: "Soberana", body: "El procesamiento ocurre en tu región/nube. Nunca almacenamos tus datos." },
          { icon: "plug", title: "Sin lock-in", body: "Tecnologías abiertas (Pulsar, PostgreSQL, n8n). Puedes intercambiar componentes." },
        ],
      },
    ],
  },

  "producto/implementacion": {
    eyebrow: "Producto · Implementación",
    icon: "cloud",
    title: "Elige el modelo que se adapta a tu operación",
    subtitle: "Tu nube, gestionado por MicroBox Labs o edge híbrido. La misma plataforma, el nivel de control y cumplimiento que necesitas.",
    blocks: [
      {
        type: "grid",
        kicker: "Opciones",
        title: "Tres formas de desplegar ModularIoT",
        cards: [
          { icon: "cloud", title: "Tu Nube", body: "Control completo en tu infraestructura AWS, Azure o GCP: soberanía de datos, seguridad a tu medida, escalado ilimitado y acceso directo a la base de datos." },
          { icon: "bolt", title: "Gestionado por MBL", body: "Nosotros manejamos la infraestructura mientras tú te enfocas en tus insights: cero overhead de DevOps, monitoreo 24/7, actualizaciones automáticas y SLA." },
          { icon: "stack", title: "Edge Híbrido", body: "Procesamiento edge para ultra-baja latencia con respaldo en nube: sub-10 ms, capacidad offline, sincronización y cumplimiento regional." },
        ],
      },
      {
        type: "steps",
        kicker: "Puesta en marcha",
        title: "De la firma a producción",
        steps: [
          { n: "01", title: "Diagnóstico", body: "Revisamos tu operación, hardware actual y los eventos que te preocupan. Sin costo." },
          { n: "02", title: "Integración y configuración", body: "Conectamos tu tecnología, definimos umbrales y reglas, y activamos el panel. 5 a 10 días hábiles (48 h en modo gestionado)." },
          { n: "03", title: "Operación con visibilidad", body: "Tu equipo opera con datos en tiempo real y recibe un reporte de impacto cada mes." },
        ],
      },
    ],
  },

  // ===================== SOLUCIONES (página por grupo) =====================
  soluciones: {
    eyebrow: "Soluciones",
    icon: "radar",
    title: "Visibilidad real para tu operación, sea cual sea",
    subtitle:
      "ModularIoT se configura para lo que importa en tu operación específica. Estos son los casos de uso e industrias donde ya genera impacto.",
    blocks: [
      {
        type: "grid",
        id: "casos-de-uso",
        kicker: "Casos de uso",
        title: "Qué puedes monitorear hoy",
        cards: [
          { icon: "truck", title: "Conductores y vehículos", body: "Velocidad por tramo, conducción continua sin descanso, zonas de riesgo y estado mecánico. Cada evento clasificado y con responsable." },
          { icon: "chart", title: "Telemetría y mantenimiento", body: "Temperatura, presión, consumo y ciclos de uso. Sabemos cuándo un activo va a fallar antes de que lo haga." },
          { icon: "shield", title: "Cumplimiento y auditorías", body: "¿Se hizo el procedimiento como estaba definido? Monitoreo de ejecución real con evidencia lista para fiscalización." },
          { icon: "radar", title: "Torre de control", body: "Vista unificada para tu equipo operacional: alertas con ciclo de vida y trazabilidad completa." },
        ],
      },
      {
        type: "grid",
        id: "industrias",
        kicker: "Industrias",
        title: "Operaciones que ya confían en ModularIoT",
        cards: [
          { icon: "truck", title: "Transporte de carga", body: "Excesos de velocidad en ruta, cumplimiento de descansos y evidencia para clientes exigentes." },
          { icon: "stack", title: "Minería", body: "Límites por tramo interno más restrictivos que el mapa oficial. Evidencia lista para cualquier fiscalización." },
          { icon: "signal", title: "Distribución y última milla", body: "Telemetría mecánica en toda la flota: fallas detectadas antes de que el vehículo se detenga." },
          { icon: "chart", title: "Logística industrial", body: "Visibilidad centralizada de activos y procesos críticos, con trazabilidad de cada evento." },
        ],
      },
      {
        type: "split",
        kicker: "Cómo empezamos",
        title: "Configurado para tu operación, no un sistema genérico",
        body:
          "No instalamos una solución de molde. Configuramos los umbrales, zonas, procesos y alertas según cómo funciona tu operación específica. Empezamos con un diagnóstico gratuito de 30 minutos.",
        bullets: [
          "Diagnóstico gratuito: qué puedes monitorear hoy",
          "Integración con tu hardware y sistemas actuales",
          "Reglas y umbrales definidos para tu operación",
          "Panel activo para tu equipo en 5 a 10 días",
          "Reporte de impacto mensual",
        ],
      },
    ],
  },

  // ===================== RECURSOS (página por grupo) =====================
  recursos: {
    eyebrow: "Recursos",
    icon: "doc",
    title: "Todo para conocer y construir con ModularIoT",
    subtitle: "Documentación, casos reales y comunidad. Aprende cómo funciona la plataforma y únete al proyecto de código abierto.",
    blocks: [
      {
        type: "linkgrid",
        kicker: "Aprende",
        title: "Documentación y contenido",
        links: [
          { title: "Documentación", body: "Guías, referencia de API e integraciones para construir sobre ModularIoT.", href: "https://docs.modulariot.com", external: true },
          { title: "Casos reales", body: "Operaciones que dejaron de enterarse tarde: transporte, minería y distribución.", href: "/#clientes" },
          { title: "Preguntas frecuentes", body: "Lo que siempre nos preguntan antes de empezar, respondido.", href: "/#faq" },
        ],
      },
      {
        type: "linkgrid",
        kicker: "Comunidad",
        title: "Código abierto y contacto",
        links: [
          { title: "GitHub", body: "Plataforma de código abierto bajo licencia Apache-2.0. Explora, contribuye, danos una estrella.", href: "https://github.com/microboxlabs", external: true },
          { title: "MicroBox Labs", body: "Conoce a la empresa detrás de ModularIoT y el resto del portafolio.", href: "https://microboxlabs.com", external: true },
          { title: "Hablar con nosotros", body: "Agenda un diagnóstico gratuito de 30 minutos para tu operación.", href: "/#contacto" },
        ],
      },
    ],
  },
};

// Diccionarios por idioma y resolvedor.
export const detailPagesByLang: Record<string, Record<string, DetailPageData>> = {
  es: detailPages,
  en: detailPagesEn,
  pt: detailPagesPt,
};

export function getDetailPages(lang?: string): Record<string, DetailPageData> {
  return (lang && detailPagesByLang[lang]) || detailPages;
}
