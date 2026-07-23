// English translation of the landing content. Same shape as content.ts (es).
// hrefs, icons, ids, tags, code snippets, times and numeric values stay identical.

export const en = {
  nav: {
    mega: {
      label: "Product",
      sections: [
        {
          title: "Platform",
          items: [
            { icon: "signal", label: "GPS Core Ingestion", href: "/producto/ingesta-gps-core", desc: "Real-time GPS and sensor signals into your database" },
            { icon: "radar", label: "Symptoms / Control Tower", href: "/producto/sintomas-torre-control", desc: "30+ detection rules with full traceability" },
            { icon: "plug", label: "Integrations", href: "/producto/integraciones", desc: "Workflows, webhooks and evidence vault" },
            { icon: "video", label: "Live Video / HLS", href: "/producto/video-en-vivo", desc: "Continuous streaming from cameras and dashcams" },
          ],
        },
        {
          title: "Technology",
          items: [
            { icon: "code", label: "Features", href: "/producto/caracteristicas", desc: "Streaming, alerts and workflows" },
            { icon: "stack", label: "Architecture", href: "/producto/arquitectura", desc: "From the edge device to your cloud in <56ms" },
            { icon: "cloud", label: "Deployment", href: "/producto/implementacion", desc: "Your cloud, MBL-managed or hybrid edge" },
          ],
        },
        {
          title: "Explore it live · real data",
          items: [
            { icon: "radar", label: "Control tower", href: "/torre", desc: "All 36 symptoms on a real operation" },
            { icon: "stack", label: "SuperProfile", href: "/superprofile", desc: "The living operational identity of each actor" },
            { icon: "plug", label: "Escalation channels", href: "/canales", desc: "The alert in email, WhatsApp, Teams, Webex and SMS" },
            { icon: "signal", label: "GPS providers", href: "/proveedores-gps", desc: "Signal precision: 12/20 pulses per minute" },
          ],
        },
      ],
    },
    columnMenus: [
      {
        label: "Solutions",
        columns: [
          {
            title: "Use cases",
            links: [
              { label: "Driver and asset monitoring", href: "/soluciones#casos-de-uso" },
              { label: "Mechanical telemetry and maintenance", href: "/soluciones#casos-de-uso" },
              { label: "Compliance and audits", href: "/soluciones#casos-de-uso" },
              { label: "Operational control tower", href: "/soluciones#casos-de-uso" },
            ],
            footer: { label: "All solutions", href: "/soluciones" },
          },
          {
            title: "Industries",
            links: [
              { label: "Freight transport", href: "/soluciones#industrias" },
              { label: "Mining", href: "/soluciones#industrias" },
              { label: "Distribution and last mile", href: "/soluciones#industrias" },
              { label: "Industrial logistics", href: "/soluciones#industrias" },
            ],
            footer: { label: "Real stories", href: "/#clientes" },
          },
        ],
      },
      {
        label: "Resources",
        columns: [
          {
            title: "Learn",
            links: [
              { label: "Documentation", href: "https://docs.modulariot.com", external: true },
              { label: "Real stories", href: "/#clientes" },
              { label: "FAQ", href: "/#faq" },
            ],
            footer: { label: "All resources", href: "/recursos" },
          },
          {
            title: "Community",
            links: [
              { label: "GitHub", href: "https://github.com/microboxlabs", external: true },
              { label: "MicroBox Labs", href: "https://microboxlabs.com", external: true },
            ],
          },
        ],
      },
    ],
    direct: [
      { label: "Pricing", href: "/precios" },
      { label: "Contact", href: "/contacto" },
    ],
    github: { label: "GitHub", href: "https://github.com/microboxlabs" },
    languages: [
      { lang: "es", country: "Chile", flag: "cl" },
      { lang: "es", country: "Peru", flag: "pe" },
      { lang: "es", country: "Colombia", flag: "co" },
      { lang: "es", country: "Mexico", flag: "mx" },
      { lang: "pt", country: "Brazil", flag: "br" },
      { lang: "en", country: "Global", flag: "gl" },
    ],
    cta: "Request a demo",
    actions: {
      demo: { label: "Get a Demo", href: "/contacto?intent=demo" },
      login: { label: "Log In", href: "/contacto?intent=login" },
      signup: { label: "Sign Up", href: "/contacto?intent=signup" },
    },
  },

  hero: {
    kicker: "Open Source · Apache-2.0",
    titlePre: "From detecting deviations to ",
    titleHighlight: "reducing them",
    titlePost: ", in your real operation.",
    subtitle:
      "We don't sell more alerts: we turn every signal into fewer repeated problems. And the data and the decisions are yours.",
    ctaPrimary: "Book a 20-min technical demo",
    ctaSecondary: "See pricing",
    livePanel: {
      title: "Live operation",
      subtitle: "a real operation, right now",
      live: "receiving events…",
      done: "it all stays in your operation",
      events: [
        { kind: "signal", title: "Signals arriving", detail: "2,847 assets reporting in real time" },
        { kind: "symptom", title: "Symptom detected", detail: "Speeding · internal route · high severity" },
        { kind: "action", title: "Escalated to the owner", detail: "supervisor notified by SMS, with evidence" },
        { kind: "record", title: "Recorded", detail: "in your database, in your cloud" },
      ],
    },
  },

  stats: {
    title: "A real operation, running today — not a demo",
    items: [
      { value: "55,847", label: "symptoms handled in a single real month" },
      { value: "65%", label: "of treated alerts get invalidated: closing ≠ solving" },
      { value: "28+", label: "GPS providers integrated" },
      { value: "1,900+", label: "assets in real operation" },
    ],
  },

  problem: {
    kicker: "The problem",
    title: "You handle every alert. The deviations come back anyway.",
    subtitle:
      "Almost everything gets attended: 97% of symptoms receive treatment. But most get invalidated — the ticket is closed, the cause isn't solved. That's why the same deviations repeat month after month.",
    pains: [
      {
        title: "“They told me the next day”",
        body: "The event had already happened. The system logged everything. But no one saw it until it was too late to act.",
      },
      {
        title: "“We have alerts, but they're noise”",
        body: "The system fires hundreds of notifications a day. The team ignores them. The critical ones get lost among the irrelevant.",
      },
      {
        title: "“We can't prove anything”",
        body: "When an audit, an inspection or a claim comes, reconstructing what happened takes days. If the data even exists.",
      },
    ],
  },

  steps: {
    kicker: "How it works in practice",
    title: "From a raw signal to a decision, in under a second",
    subtitle: "The same event you see in the live flow, told step by step.",
    items: [
      {
        n: "01",
        title: "The signal is captured",
        body: "Every GPS ping, sensor value and driver event enters your flow in milliseconds, regardless of the hardware vendor.",
        tag: "INGESTA",
      },
      {
        n: "02",
        title: "Processed in real time",
        body: "The streaming engine enriches and evaluates the signal against 30+ rules, with median latency under 56 ms.",
        tag: "STREAM",
      },
      {
        n: "03",
        title: "The symptom is detected",
        body: "If something deviates from your operation's standard, a severity-classified event is generated — not just another generic notification.",
        tag: "SÍNTOMA",
      },
      {
        n: "04",
        title: "The response is triggered",
        body: "The event is assigned to an owner and fires the flow you defined: SMS, panel alert, work order or webhook.",
        tag: "WORKFLOW",
      },
      {
        n: "05",
        title: "The evidence remains",
        body: "Everything is logged with timestamp, owner and resolution in your own database. Audit ready in seconds, not days.",
        tag: "EVIDENCIA",
      },
    ],
    outro: {
      latency: "< 56 ms median end-to-end latency",
      subtitle: "From sensor reading to the data sitting in your own database.",
    },
  },

  painOutcome: {
    kicker: "The real shift",
    title: "The difference between alerting and reducing",
    left: {
      title: "Just alerting",
      items: [
        "The inbox fills with notifications the team ends up ignoring",
        "The ticket gets closed, but the cause behind it stays",
        "The same deviations repeat month after month",
        "No one knows whether the handling actually reduced the problem",
        "The data stays trapped in a third-party system",
      ],
    },
    right: {
      title: "With ModularIoT",
      items: [
        "Every symptom arrives with an owner, context and action plan",
        "We attack the root cause, not just today's event",
        "We measure the real reduction of deviations month over month",
        "The SuperProfile shows whether each actor improves or repeats",
        "The data and the decisions stay under your control",
      ],
    },
  },

  features: {
    kicker: "Features",
    title: "Three core capabilities",
    subtitle: "Everything you need to process, analyze and act on fleet data in real time",
    cards: [
      {
        icon: "signal",
        title: "Real-time processing",
        body: "Every GPS signal, sensor and driver event is processed as it arrives, with median latency under 56 ms.",
        bullets: ["One source for all telemetry", "Enriched and evaluated instantly", "Thousands of events per second, no batch"],
      },
      {
        icon: "radar",
        title: "Symptom-based alerts",
        body: "Over 30 rules detect the deviation —fatigue, speeding, risk zones— and generate a classified event, not one more generic notification.",
        bullets: ["Automatic severity and owner", "Smart noise exclusion", "Action fired: SMS, dashboard or work order"],
      },
      {
        icon: "plug",
        title: "Escalation by symptom",
        body: "Each symptom is escalated to the channel where the operation lives —email, WhatsApp, Teams— with a two-way conversation, a plan and an owner.",
        bullets: ["Channel by symptom type", "Two-way loop, not just notify", "Every alert arrives with a plan and an owner"],
      },
    ],
  },

  architecture: {
    kicker: "Architecture",
    title: "From the edge device to your infrastructure",
    subtitle: "See how your data flows from edge devices to your cloud in real time",
    steps: [
      { n: "01", title: "Data ingestion", body: "Collect GPS, sensor and event data from your fleet in real time" },
      { n: "02", title: "Stream processing", body: "Process and analyze data streams with sub-second latency" },
      { n: "03", title: "Your infrastructure", body: "Data flows straight into your database, analytics and applications" },
    ],
    latency: "< 56 ms median end-to-end latency",
    latencySubtitle: "From sensor reading to your application's response",
  },

  useCases: {
    kicker: "Use cases",
    title: "Four processing boxes. Only pay for the ones you need.",
    subtitle:
      "Modular architecture with no vendor lock-in: each box is an independent service with its own per-asset price.",
    cards: [
      {
        id: "ingesta",
        icon: "signal",
        title: "GPS Core Ingestion",
        body: "Every GPS ping, sensor signal and driver event flows to your systems in milliseconds. Last-signal API, AVL tracking and change data capture into your systems.",
        bullets: ["Last-signal API per asset", "Real-time AVL tracking", "CDC into your downstream systems"],
      },
      {
        id: "sintomas",
        icon: "radar",
        title: "Symptoms / Control Tower",
        body: "Over 30 detection rules: speed by segment, continuous driving, risk zones, fatigue, mechanical telemetry. Each event with severity, owner and full traceability.",
        bullets: ["Automatic severity and owner", "Lifecycle: open → handle → close", "Smart noise exclusion"],
      },
      {
        id: "integraciones",
        icon: "plug",
        title: "Integrations",
        body: "Workflow automation with n8n, document manager for evidence, API gateway and webhooks. Your operation connected to the systems you already use.",
        bullets: ["Workflows and webhooks (n8n)", "Document evidence vault", "APIs and gateway for your systems"],
      },
      {
        id: "video",
        icon: "video",
        title: "Live Video / HLS",
        body: "Continuous 24-hour video streams from cameras on board your assets. Visual context for every detected event.",
        bullets: ["Continuous 24h HLS streaming", "Frames from cameras and dashcams", "Visual context for each alert"],
      },
    ],
  },

  stories: {
    kicker: "Customers",
    metrics: [
      { value: "1,900+", label: "assets in real operation" },
      { value: "97%", label: "of symptoms handled" },
      { value: "36", label: "detection rules in production" },
      { value: "5", label: "escalation channels" },
    ],
    title: "Operations that stopped finding out too late",
    cases: [
      {
        tag: "Transport & Mining",
        before:
          "Company with its own fleet in a mining operation. No evidence of speeding on internal routes. Audits that took days.",
        after:
          "Automatic severity-based speeding detection from month one. Limits by internal segment, stricter than the official map. Evidence ready for any inspection, in seconds.",
      },
      {
        tag: "Distribution Fleet",
        before:
          "Fleet of 390 light vehicles. Vehicles breaking down on the road with no warning. No mechanical-state data until the driver called the boss.",
        after:
          "Mechanical telemetry active across the whole fleet. Check Engine, low battery and alternator failure detected before the breakdown.",
      },
    ],
    quotes: [
      {
        text: "Now when something happens, the first thing my team does is open the system and look for the event. Before, they'd call the driver.",
        author: "Head of Operations, Freight Transport Company, Chile",
      },
      {
        text: "I had GPS on every vehicle. The truck drove through a risk zone at night and no one told me. I found out the next day. That doesn't happen anymore.",
        author: "Fleet Manager, Logistics Company, Northern Chile",
      },
    ],
  },

  deployment: {
    kicker: "Deployment",
    title: "Deployment",
    subtitle: "A rollout managed by MicroBox Labs on your own cloud: we run the infrastructure, you focus on the operation. Live in days, not months.",
    soonLabel: "Coming soon",
    includes: [
      { title: "Configured to your operation", body: "Thresholds, zones and rules tuned to how you work — not a generic template." },
      { title: "Deployed in your cloud", body: "Runs on your own infrastructure (AWS, Azure or GCP); your data never leaves your control.", soon: true },
      { title: "Connected to your systems", body: "API integration with the platforms you already use (dispatch, maintenance, ERP); it adds to your operation, doesn't replace it." },
      { title: "Your operation's channels", body: "Email, WhatsApp, Teams, Webex and SMS connected so the alert reaches where the team lives." },
      { title: "Managed rollout", body: "MicroBox Labs runs and supports the operation, with zero DevOps overhead on your side." },
      { title: "Monitoring, support and updates", body: "The platform stays current and monitored without you having to deal with it." },
    ],
  },

  pricingTeaser: {
    kicker: "Pricing",
    title: "Pay per asset, only for what you use",
    subtitle:
      "No per-seat licenses, no setup costs. Each processing box has its own per-asset/month price. Build your plan with the calculator.",
    cta: "Calculate your fleet's price",
  },

  faq: {
    kicker: "FAQ",
    title: "Frequently asked questions",
    items: [
      {
        q: "What's the difference between ModularIoT and traditional telematics providers?",
        a: "Traditional providers stop at alerting: they notify you and that's it. ModularIoT interprets every symptom, assigns an owner and a plan, and measures whether the deviation actually drops month over month. On top of that, the data and processing logic stay under your control, with no lock-in on per-asset fees. It's the difference between alerting and reducing.",
      },
      {
        q: "How does ModularIoT compare to Apache Kafka or Apache Pulsar?",
        a: "Kafka and Pulsar are excellent message brokers; ModularIoT is a complete fleet-data processing platform. We use Pulsar under the hood, but add fleet-specific processors, detection rules and ready-to-use integrations. Enterprise-grade streaming without building everything from scratch.",
      },
      {
        q: "Do I need to change my current technology?",
        a: "No. We integrate with the sensors, GPS, cameras and systems you already have installed. During the assessment we review your current technology and confirm compatibility.",
      },
      {
        q: "What about GDPR and data sovereignty?",
        a: "Data sovereignty is a core principle: all processing happens in your chosen region/cloud and we never store your fleet data in our systems. We include anonymization, retention policies and audit trails. Your data stays under your control at all times.",
      },
      {
        q: "How fast can we get started?",
        a: "For managed deployments, you can be processing live data in 48 hours. Your-cloud deployments typically take 1-2 weeks including infrastructure setup and integration testing.",
      },
      {
        q: "Does the system generate too many alerts the team ends up ignoring?",
        a: "That's exactly what we avoid. Alerts have smart exclusion rules: no notification is generated unless it meets the conditions configured for your operation. Your operators only see what matters and requires action.",
      },
      {
        q: "What kind of support do you offer?",
        a: "All plans include technical support through our portal. Higher tiers include a dedicated Customer Success Manager and priority response times, up to 24/7 support with guaranteed SLAs.",
      },
    ],
  },

  finalCta: {
    title: "Ready to reduce your operation's deviations?",
    body: "No more alerts piling up. Turn every signal into fewer repeated problems — with your data and your decisions under your control. See it running in 20 minutes.",
    cta: "Book an onboarding call",
    note: "No commitment · Response within 24 hours",
    stats: [
      { value: "48hr", label: "managed deployment setup" },
      { value: "0%", label: "data vendor dependency" },
      { value: "100%", label: "your data, your control" },
    ],
  },

  footer: {
    description: "We turn every fleet signal into fewer repeated deviations. The data and the decisions are yours.",
    columns: [
      {
        title: "Explore",
        links: [
          { label: "Control tower", href: "/torre" },
          { label: "SuperProfile", href: "/superprofile" },
          { label: "Escalation channels", href: "/canales" },
          { label: "GPS providers", href: "/proveedores-gps" },
          { label: "Pricing", href: "/precios" },
        ],
      },
      {
        title: "Documentation",
        links: [
          { label: "Quick start", href: "https://docs.modulariot.com" },
          { label: "API reference", href: "https://docs.modulariot.com" },
          { label: "Integrations", href: "https://docs.modulariot.com" },
          { label: "GitHub", href: "https://github.com/microboxlabs" },
        ],
      },
      {
        title: "Company",
        links: [
          { label: "About MicroBox Labs", href: "https://microboxlabs.com" },
          { label: "Contact", href: "/contacto" },
        ],
      },
    ],
    copyright: `© ${new Date().getFullYear()} MicroBox Labs · All rights reserved`,
  },

  pricingPage: {
    title: "Pricing",
    subtitle:
      "Pay based on usage, not per-seat licenses. Each processing box has its own per-asset/month price and scales as your fleet grows.",
    philosophy: [
      {
        title: "Pay only for what you use",
        body: "You contract independent processing boxes. If you don't use video or integrations, you don't pay for them.",
      },
      {
        title: "Transparent per-asset price",
        body: "A fixed per-asset/month price for each box. No surprises, no setup costs, no minimum term.",
      },
      {
        title: "Based on real costs",
        body: "Prices derive from the platform's real per-transaction infrastructure cost, not an arbitrary rate.",
      },
    ],
    faqTitle: "Pricing questions",
    faqs: [
      {
        q: "How is the service billed?",
        a: "Monthly subscription per monitored vehicle or asset, based on the processing boxes you contract. The final proposal is delivered after the free assessment.",
      },
      {
        q: "Are the calculator prices final?",
        a: "They're indicative, based on real infrastructure costs. The formal proposal may vary depending on volume, rule configuration and deployment model (your cloud, managed or hybrid edge).",
      },
      {
        q: "Are there setup costs or a minimum term?",
        a: "No. Integration with your current technology is included and you can adjust or cancel the contracted boxes month to month.",
      },
      {
        q: "What does each box include?",
        a: "Each box is a complete service: infrastructure, processing, management panel and support. The GPS Core Ingestion box is the foundation the others run on.",
      },
    ],
    cta: {
      title: "Is your case more complex?",
      body: "Large fleets, multiple operations or specific compliance requirements: let's talk and build a tailored proposal.",
      button: "Talk to us",
    },
  },
};
