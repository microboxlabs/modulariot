---
name: Modular IoT Landing Brief
description: Source-of-truth product narrative. The loop reads this when generating copy, picking sections, or scoring narrative fidelity.
---

# Intent Behind the Modular IoT Landing Page

The landing page should help people understand **why Modular IoT exists**, not only what it does.

Modular IoT is an open-source real-time monitoring platform born from real operational needs:
fleets, logistics, telemetry, incident handling, and control-tower workflows. The product is
technical, but the landing should not feel like a technical diagram dumped into a webpage. It
should tell a clear story.

The story is:

> Raw telemetry is noisy.
> Alerts are often shallow.
> Operations need context.
> Modular IoT turns real-time signals into symptoms, symptoms into understanding, and
> understanding into coordinated action.

That is the center of the page.

## Main intention
Position Modular IoT as something more than a fleet dashboard. The landing should communicate
that Modular IoT is:
1. Open-source
2. Composable
3. Real-time
4. Cloud-native
5. Built around Symptom Intelligence
6. Designed for real operational workflows
7. Flexible enough to evolve its internal stack over time

Specific technologies (Postgres, Pulsar, n8n, etc.) are implementation choices and should NOT
be the main identity of the product on the landing.

The deeper idea:
> Modular IoT captures operational behavior and turns it into a living symptom model that can
> be observed, escalated, treated, audited, and integrated.

## Inspiration
**Supabase** — for the structural progression, not the look:
simple hero → strong open-source signal → clear product primitives → visual feature blocks →
examples/templates → trust signals → community/developer orientation → final CTA.

Supabase doesn't try to explain everything at once. We borrow that spirit, not the aesthetic.

## What the visitor should feel
> "This is an open-source platform for real-time monitoring, but it has a more advanced
> operational model than just showing dots on a map."

Modular IoT is: serious-but-not-corporate, technical-but-understandable, open-but-production-minded,
modular-but-coherent, alive-not-static, built-from-real-operational-pressure.

Ideal reaction: not "I understand every component" — but "I get the idea. This is different.
I want to see it running."

## Core narrative arc
1. **Open-source real-time monitoring** — Own your fleet and telemetry data in real time.
   Visible GitHub presence in the header.
2. **From telemetry to symptoms** — `signals → behaviors → symptoms → treatments → operational evidence`.
   A symptom is not just an alert. Symptoms have state, severity, evolution, treatment, audit.
3. **Modular architecture** — capture, stream, analyze, identify symptoms, orchestrate, visualize,
   store evidence. Replaceable components around a consistent operational model.
4. **Real-world operations** — fleet monitoring, GPS events, loss of signal, driver fatigue,
   risk zones, geofences, evidence, dispatch and control-tower tasks.
5. **Developer + operator trust** — speak to both audiences without over-indexing on either.

## Section structure (Supabase-like)
1. Promo ribbon (optional, dismissible)
2. Header / nav with visible GitHub button
3. Hero — promise + subtext + primary CTA + secondary GitHub/docs CTA + live-telemetry visual
4. Logo wall / trust strip — use "Built for logistics, fleet operations, industrial telemetry"
   if real public logos are absent. NO fake social proof.
5. Feature bento — ingestion, symptom intelligence, real-time dashboards, orchestration,
   evidence/audit, OSS deployment, developer APIs/integrations
6. Architecture — `Capture → Stream → Symptom Intelligence → Orchestrate → Visualize/Audit`
7. Hardware/cloud compatibility banner — flexibility across GPS providers, telemetry sources, clouds
8. Examples / quick-start gallery — GitHub examples, Helm charts, n8n flows, API examples
9. Dashboard showcase — map, symptom timeline, incident state, control-tower view
10. Community / open-source — GitHub, contribution, roadmap, public docs
11. Final CTA — see it running / book demo / explore repo
12. Footer — product / developers / company / resources / GitHub / docs / status

## Visual direction
Avoid generic enterprise SaaS. The page should feel: clean, technical, open-source, slightly
playful, precise, modular, real-time.

Brand palette:
- **blue** — core platform
- **yellow** — energy and attention
- **orange** — critical state or motion
- **gray** — structure and neutrality

Visual metaphor: a living system made of small boxes, where data flows through the boxes and
becomes operational understanding.

## Concepts to preserve in copy and design
- Open-source first
- Bring your own cloud (user owns data + infra)
- Swap-a-box architecture (components evolve / replaceable)
- Symptoms, not just alerts (the conceptual differentiator)
- Real-time behavior (page should feel active, flowing)
- Operational evidence (actions and symptoms leave a trace)
- Built from real fleet/logistics needs (grounded)

## What NOT to do
Avoid making the page about today's stack:
- ❌ "We are a Pulsar platform"
- ❌ "We are a PostgreSQL CDC platform"
- ❌ "We are an n8n workflow platform"

Instead:
- ✅ "Modular IoT is a real-time operational intelligence platform built from open,
  replaceable components."

Avoid making it too corporate or too playful. Owl mascot can bring personality but the landing
must still feel production-ready.

## North Star
A visitor should leave understanding:
> Modular IoT is an open-source real-time monitoring platform that turns telemetry into
> operational symptoms, and symptoms into action.

And feeling:
> "This is not just another fleet dashboard. This is a system I can build on."
