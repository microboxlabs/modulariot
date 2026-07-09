import type { DetailPageData } from "./DetailPage";

// English content for the detail pages. Same keys/shape as detail-content.ts (es).

export const detailPagesEn: Record<string, DetailPageData> = {
  "producto/ingesta-gps-core": {
    eyebrow: "Product · GPS Core Ingestion",
    icon: "signal",
    graphic: "ingesta",
    title: "Every signal from your fleet, in your cloud, in milliseconds",
    subtitle:
      "ModularIoT's base box. It receives every GPS ping, sensor value and driver event —regardless of the hardware vendor— and delivers it to your own infrastructure in real time.",
    blocks: [
      {
        type: "split",
        kicker: "What it does",
        title: "The pipeline everything else runs on",
        body:
          "GPS Core Ingestion normalizes and streams your fleet's raw telemetry into your systems. It's the foundation: symptoms, integrations and video are built on top of this flow. No vendor lock-in and your data always under your control.",
        bullets: [
          "Last-signal API per asset (lastsignal)",
          "Real-time AVL tracking",
          "Change data capture (CDC) into your downstream systems",
          "Messaging backbone with Apache Pulsar",
          "Direct writes to your PostgreSQL / storage",
        ],
      },
      {
        type: "grid",
        kicker: "Capabilities",
        title: "Production-ready ingestion",
        cards: [
          { icon: "signal", title: "Any hardware", body: "Universal adapters for GPS providers (Redd, Samtech, GAMA and more). You don't change your devices." },
          { icon: "bolt", title: "Latency < 56 ms", body: "From sensor reading to your application, with low-latency stream processing." },
          { icon: "stack", title: "High volume", body: "Built for millions of signals per month: 2.9M+ in real operation today, with room to grow." },
          { icon: "shield", title: "Your data, your cloud", body: "Data lands in your infrastructure. Full sovereignty, effortless GDPR compliance." },
          { icon: "plug", title: "Built-in CDC", body: "Debezium captures changes and propagates them to your systems: no polling, no batch jobs." },
          { icon: "code", title: "Open APIs", body: "REST and direct database access to build whatever you need on top of the flow." },
        ],
      },
      {
        type: "code",
        kicker: "What it looks like",
        title: "Set up the pipeline in minutes",
        cards: [
          {
            title: "Ingestion pipeline",
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
            title: "Last signal per asset",
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
    eyebrow: "Product · Symptoms / Control Tower",
    icon: "radar",
    graphic: "sintomas",
    title: "Over 30 rules that turn data into decisions",
    subtitle:
      "No more raw data or noisy alerts. Every signal is evaluated against your operation's rules and, if something deviates, a severity-classified event is generated, with an owner and full traceability.",
    blocks: [
      {
        type: "split",
        kicker: "What it does",
        title: "It interprets, not just logs",
        body:
          "The difference between a GPS and ModularIoT is the same as between a security camera and a trained guard. The control tower interprets each event in its operational context: is it a risk zone? how long has it been active? who should handle it?",
        bullets: [
          "Severity and owner assigned automatically",
          "Event lifecycle: open → handle → close",
          "Smart noise exclusion: only what requires action",
          "Thresholds and zones configured for your operation",
          "Full traceability for audits",
        ],
      },
      {
        type: "grid",
        kicker: "Detection rules",
        title: "A rule for every risk that matters to you",
        subtitle: "Over 30 rules active in production, each an independent microservice.",
        cards: [
          { icon: "radar", title: "Driving", body: "Speeding by segment, continuous driving without rest, movement in unauthorized hours, dual driver." },
          { icon: "shield", title: "Safety", body: "Panic button (SOS), roadside assistance, PPE use, man-machine, harsh braking and turning, fatigue and drowsiness." },
          { icon: "truck", title: "Cargo and assets", body: "Missing and deficient load securing, engine overheating, Check Engine, low battery, charging failure." },
          { icon: "signal", title: "Zones and routes", body: "Crossing a restricted area, stopping in a risk zone, overnight stay in an unauthorized zone, ETA deviation." },
        ],
      },
      {
        type: "steps",
        kicker: "Lifecycle",
        title: "The cycle doesn't end at closing: it ends at reducing",
        subtitle: "Closing the ticket doesn't solve the cause. That's why the cycle adds one more step: reducing recurrence.",
        steps: [
          { n: "01", title: "The symptom is detected", body: "The rule evaluates the signal in context and generates an event with severity." },
          { n: "02", title: "An owner is assigned", body: "The event enters your operational team's panel and is assigned to be handled." },
          { n: "03", title: "It gets handled", body: "The operator handles the event with the context and evidence needed to act." },
          { n: "04", title: "It closes with traceability", body: "It's logged with timestamp, owner and resolution. Nothing gets lost." },
          { n: "05", title: "Recurrence is reduced", body: "The SuperProfile aggregates history by entity and attacks the cause: fewer repeated events month over month, not just closed tickets." },
        ],
      },
      {
        type: "linkgrid",
        kicker: "Live, with real data",
        title: "Explore it on a real operation",
        subtitle: "The same symptoms, running on June 2026 data — not a mockup.",
        links: [
          { title: "Control tower", body: "All 36 symptoms, their history and their dashboards with real data.", href: "/torre" },
          { title: "SuperProfile", body: "The living profile of every carrier and driver: level, risk and plan.", href: "/superprofile" },
          { title: "Escalation channels", body: "The same alert across email, WhatsApp, Teams, Webex and SMS.", href: "/canales" },
        ],
      },
    ],
  },

  "producto/integraciones": {
    eyebrow: "Product · Integrations",
    icon: "plug",
    graphic: "integraciones",
    title: "Your operation connected to what you already use",
    subtitle:
      "Workflow automation, document evidence vault, API gateway and webhooks. ModularIoT doesn't replace your systems: it connects and empowers them.",
    blocks: [
      {
        type: "split",
        kicker: "What it does",
        title: "From event to action, automatically",
        body:
          "When a symptom is detected, seeing it isn't enough: you have to act. Integrations fires the flow you defined —notify, create a work order, store evidence, alert an external system— with no manual intervention.",
        bullets: [
          "Workflows and webhooks with n8n",
          "Document evidence vault (ECM manager)",
          "API gateway to expose and consume services",
          "MCP server for AI agents",
          "GAMA, RFID and custom process automation",
        ],
      },
      {
        type: "grid",
        kicker: "Connectors",
        title: "Integrate with your real stack",
        cards: [
          { icon: "plug", title: "n8n", body: "Orchestrate visual flows: when X happens, do Y. Without writing integration code." },
          { icon: "doc", title: "Evidence vault", body: "Every event keeps its documentation, ready for inspections and audits." },
          { icon: "code", title: "API Gateway", body: "Expose your services securely and consume third-party APIs from a single point." },
          { icon: "stack", title: "Webhooks", body: "Notify any external system in real time when a relevant event occurs." },
          { icon: "bolt", title: "MCP Server", body: "Connect AI agents to your operation for assisted queries and actions." },
          { icon: "signal", title: "GAMA / RFID", body: "Provider ingestion and RFID tag validation via automated flows." },
        ],
      },
    ],
  },

  "producto/video-en-vivo": {
    eyebrow: "Product · Live Video / HLS",
    icon: "video",
    graphic: "video",
    title: "Visual context for every event you detect",
    subtitle:
      "Continuous 24-hour video streams from cameras on board your assets. When a symptom fires, you don't just know what happened: you can see it.",
    blocks: [
      {
        type: "split",
        kicker: "What it does",
        title: "From device frames to live video",
        body:
          "The stream processor consumes your camera frames and generates continuous HLS streams with FFmpeg. A 24-hour rolling video that gives visual context to every alert, without relying on an external video-surveillance vendor.",
        bullets: [
          "Continuous 24-hour HLS streaming",
          "Frames processed from cameras and dashcams",
          "Visual context tied to each detected event",
          "Storage on your own infrastructure",
          "Offline frame verification and recovery",
        ],
      },
      {
        type: "grid",
        kicker: "Capabilities",
        title: "Operational video, not just recording",
        cards: [
          { icon: "video", title: "24h HLS", body: "Continuous rolling streams: there's always video available for the period you need to review." },
          { icon: "bolt", title: "FFmpeg", body: "Frame-to-video processing with the industry standard, in your pipeline." },
          { icon: "radar", title: "Linked to symptoms", body: "Every control-tower event can link the video of the exact moment." },
          { icon: "shield", title: "Your storage", body: "Frames and video live in your bucket. No external video-surveillance licenses." },
        ],
      },
    ],
  },

  "producto/caracteristicas": {
    eyebrow: "Product · Features",
    icon: "code",
    title: "Three core capabilities",
    subtitle:
      "Everything you need to process, analyze and act on fleet data in real time, on an open architecture you control.",
    blocks: [
      {
        type: "code",
        kicker: "Streaming",
        title: "Real-time streaming pipeline",
        subtitle: "Process every signal as it arrives, with sub-second latency.",
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
            title: "Symptom alerts",
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
        kicker: "Why it matters",
        title: "Capabilities that translate into operations",
        cards: [
          { icon: "bolt", title: "Real time", body: "Act while the event is happening, not the next day. Median latency under 56 ms." },
          { icon: "radar", title: "Smart detection", body: "Over 30 rules with noise exclusion: your team sees only what matters." },
          { icon: "doc", title: "Evidence vault", body: "Automated workflows with 7-year traceability, compliance-ready." },
        ],
      },
    ],
  },

  "producto/arquitectura": {
    eyebrow: "Product · Architecture",
    icon: "stack",
    title: "From the edge device to your infrastructure",
    subtitle: "See how your data flows from devices to your cloud in real time, with median end-to-end latency under 56 ms.",
    blocks: [
      {
        type: "steps",
        kicker: "The flow",
        title: "Three stages, one pipeline",
        steps: [
          { n: "01", title: "Data ingestion", body: "Collect GPS, sensor and event data from your fleet in real time, from any hardware." },
          { n: "02", title: "Stream processing", body: "Enrich and evaluate data streams with sub-second latency against your operation's rules." },
          { n: "03", title: "Your infrastructure", body: "Data flows straight into your database, analytics and applications. You own it." },
        ],
      },
      {
        type: "stats",
        items: [
          { value: "<56ms", label: "median end-to-end latency" },
          { value: "2.9M+", label: "signals processed per month" },
          { value: "99.9%", label: "event processing accuracy" },
          { value: "24/7", label: "continuous operation" },
        ],
      },
      {
        type: "grid",
        kicker: "Design principles",
        title: "Open, modular and yours",
        cards: [
          { icon: "stack", title: "Modular", body: "Each box is an independent service. You contract and scale only what you use." },
          { icon: "shield", title: "Sovereign", body: "Processing happens in your region/cloud. We never store your data." },
          { icon: "plug", title: "No lock-in", body: "Open technologies (Pulsar, PostgreSQL, n8n). You can swap components." },
        ],
      },
    ],
  },

  "producto/implementacion": {
    eyebrow: "Product · Deployment",
    icon: "cloud",
    title: "Choose the model that fits your operation",
    subtitle: "Your cloud, MBL-managed or hybrid edge. The same platform, the level of control and compliance you need.",
    blocks: [
      {
        type: "grid",
        kicker: "Options",
        title: "Three ways to deploy ModularIoT",
        cards: [
          { icon: "cloud", title: "Your Cloud", body: "Full control on your AWS, Azure or GCP infrastructure: data sovereignty, security your way, unlimited scaling and direct database access." },
          { icon: "bolt", title: "MBL-Managed", body: "We handle the infrastructure while you focus on your insights: zero DevOps overhead, 24/7 monitoring, automatic updates and SLA." },
          { icon: "stack", title: "Hybrid Edge", body: "Edge processing for ultra-low latency with cloud backup: sub-10 ms, offline capability, sync and regional compliance." },
        ],
      },
      {
        type: "steps",
        kicker: "Getting started",
        title: "From signing to production",
        steps: [
          { n: "01", title: "Assessment", body: "We review your operation, current hardware and the events that concern you. Free." },
          { n: "02", title: "Integration and setup", body: "We connect your technology, define thresholds and rules, and activate the panel. 5 to 10 business days (48h in managed mode)." },
          { n: "03", title: "Operating with visibility", body: "Your team operates with real-time data and gets an impact report every month." },
        ],
      },
    ],
  },

  soluciones: {
    eyebrow: "Solutions",
    icon: "radar",
    title: "Real visibility for your operation, whatever it is",
    subtitle:
      "ModularIoT is configured for what matters in your specific operation. These are the use cases and industries where it already delivers impact.",
    blocks: [
      {
        type: "grid",
        id: "casos-de-uso",
        kicker: "Use cases",
        title: "What you can monitor today",
        cards: [
          { icon: "truck", title: "Drivers and vehicles", body: "Speed by segment, continuous driving without rest, risk zones and mechanical state. Each event classified and with an owner." },
          { icon: "chart", title: "Telemetry and maintenance", body: "Temperature, pressure, consumption and usage cycles. We know when an asset is about to fail before it does." },
          { icon: "shield", title: "Compliance and audits", body: "Was the procedure done as defined? Real-execution monitoring with evidence ready for inspection." },
          { icon: "radar", title: "Control tower", body: "A unified view for your operational team: alerts with lifecycle and full traceability." },
        ],
      },
      {
        type: "grid",
        id: "industrias",
        kicker: "Industries",
        title: "Operations that already trust ModularIoT",
        cards: [
          { icon: "truck", title: "Freight transport", body: "Speeding on route, rest compliance and evidence for demanding clients." },
          { icon: "stack", title: "Mining", body: "Limits by internal segment, stricter than the official map. Evidence ready for any inspection." },
          { icon: "signal", title: "Distribution and last mile", body: "Mechanical telemetry across the whole fleet: failures detected before the vehicle stops." },
          { icon: "chart", title: "Industrial logistics", body: "Centralized visibility of critical assets and processes, with traceability of every event." },
        ],
      },
      {
        type: "split",
        kicker: "How we start",
        title: "Configured for your operation, not a generic system",
        body:
          "We don't install a one-size-fits-all solution. We configure the thresholds, zones, processes and alerts based on how your specific operation works. We start with a free 30-minute assessment.",
        bullets: [
          "Free assessment: what you can monitor today",
          "Integration with your current hardware and systems",
          "Rules and thresholds defined for your operation",
          "Active panel for your team in 5 to 10 days",
          "Monthly impact report",
        ],
      },
    ],
  },

  recursos: {
    eyebrow: "Resources",
    icon: "doc",
    title: "Everything to learn and build with ModularIoT",
    subtitle: "Documentation, real stories and community. Learn how the platform works and join the open-source project.",
    blocks: [
      {
        type: "linkgrid",
        kicker: "Learn",
        title: "Documentation and content",
        links: [
          { title: "Documentation", body: "Guides, API reference and integrations to build on ModularIoT.", href: "https://docs.modulariot.com", external: true },
          { title: "Real stories", body: "Operations that stopped finding out too late: transport, mining and distribution.", href: "/#clientes" },
          { title: "FAQ", body: "What people always ask us before starting, answered.", href: "/#faq" },
        ],
      },
      {
        type: "linkgrid",
        kicker: "Community",
        title: "Open source and contact",
        links: [
          { title: "GitHub", body: "Open-source platform under Apache-2.0 license. Explore, contribute, give us a star.", href: "https://github.com/microboxlabs", external: true },
          { title: "MicroBox Labs", body: "Meet the company behind ModularIoT and the rest of the portfolio.", href: "https://microboxlabs.com", external: true },
          { title: "Talk to us", body: "Book a free 30-minute assessment for your operation.", href: "/#contacto" },
        ],
      },
    ],
  },
};
