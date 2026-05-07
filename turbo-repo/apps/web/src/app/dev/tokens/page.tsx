import { Alert, Badge, Button, Card } from "flowbite-react";

const SCALES = ["50", "100", "200", "300", "400", "500", "600", "700", "800", "900", "950"] as const;

const ROLES: { name: string; family: string; cssVar: string; usage: string }[] = [
  { name: "primary", family: "blue", cssVar: "--color-blue-500", usage: "Core platform actions, links, headings" },
  { name: "attention", family: "yellow", cssVar: "--color-yellow-500", usage: "Energy, highlights, callouts" },
  { name: "critical", family: "orange", cssVar: "--color-orange-500", usage: "Incidents, motion, urgent state" },
  { name: "neutral", family: "gray", cssVar: "--color-gray-500", usage: "Structure, surfaces, body copy" },
];

const FAMILIES = ["blue", "yellow", "orange", "gray"] as const;

function PaletteRow({ family }: { family: (typeof FAMILIES)[number] }) {
  return (
    <div className="flex flex-col gap-1">
      <div className="text-sm font-medium capitalize text-gray-700 dark:text-gray-300">
        {family}
      </div>
      <div className="grid grid-cols-11 gap-1">
        {SCALES.map((stop) => (
          <div key={stop} className="flex flex-col items-center gap-1">
            <div
              className="h-12 w-full rounded-md border border-black/5"
              style={{ backgroundColor: `var(--color-${family}-${stop})` }}
              aria-label={`${family}-${stop}`}
            />
            <span className="text-[10px] text-gray-500">{stop}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function TokensDemoPage() {
  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-12 px-6 py-12">
      <header className="flex flex-col gap-2">
        <p className="text-xs uppercase tracking-wider text-orange-500">
          /dev/tokens — internal preview
        </p>
        <h1 className="text-3xl font-semibold tracking-tight">
          Modular IoT design tokens
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Verifies the brand palette and skinned primitives. Removed in P5-06.
        </p>
      </header>

      <section className="flex flex-col gap-6">
        <h2 className="text-xl font-semibold">Semantic roles</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {ROLES.map((role) => (
            <div
              key={role.name}
              className="flex flex-col gap-3 rounded-xl border border-gray-200 p-4 dark:border-gray-800"
            >
              <div
                className="h-16 w-full rounded-lg"
                style={{ backgroundColor: `var(${role.cssVar})` }}
                aria-hidden
              />
              <div className="flex flex-col gap-1">
                <div className="text-sm font-semibold">{role.name}</div>
                <code className="text-xs text-gray-500">{role.cssVar}</code>
                <p className="text-xs text-gray-500">{role.usage}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-6">
        <h2 className="text-xl font-semibold">Full palette</h2>
        <div className="flex flex-col gap-6">
          {FAMILIES.map((family) => (
            <PaletteRow key={family} family={family} />
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-6">
        <h2 className="text-xl font-semibold">Skinned primitives</h2>

        <div className="flex flex-col gap-4">
          <h3 className="text-sm font-medium text-gray-500">Buttons</h3>
          <div className="flex flex-wrap gap-2">
            <Button color="blue">Primary</Button>
            <Button color="yellow">Attention</Button>
            <Button color="red">Critical</Button>
            <Button color="gray">Neutral</Button>
            <Button color="light">Light</Button>
            <Button color="dark">Dark</Button>
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <h3 className="text-sm font-medium text-gray-500">Badges</h3>
          <div className="flex flex-wrap gap-2">
            <Badge color="info">Symptom</Badge>
            <Badge color="warning">Watching</Badge>
            <Badge color="failure">Critical</Badge>
            <Badge color="success">Resolved</Badge>
            <Badge color="gray">Archived</Badge>
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <h3 className="text-sm font-medium text-gray-500">Cards</h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Card>
              <h4 className="font-semibold">Telemetry</h4>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Raw signals captured in real time.
              </p>
            </Card>
            <Card>
              <h4 className="font-semibold">Symptoms</h4>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Behaviors elevated to operational state.
              </p>
            </Card>
            <Card>
              <h4 className="font-semibold">Treatments</h4>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Coordinated action with a paper trail.
              </p>
            </Card>
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <h3 className="text-sm font-medium text-gray-500">Alerts</h3>
          <div className="flex flex-col gap-2">
            <Alert color="info">Connection healthy — 1,247 devices reporting.</Alert>
            <Alert color="warning">Signal-loss watching: 12 vehicles in fatigue zone.</Alert>
            <Alert color="failure">Geofence breach detected on route 47.</Alert>
          </div>
        </div>
      </section>

      <footer className="border-t border-gray-200 pt-6 text-xs text-gray-500 dark:border-gray-800">
        Source: <code>apps/web/src/app/dev/tokens/page.tsx</code> — generated in
        ralph iter-4 (P0-04). Removed in P5-06.
      </footer>
    </main>
  );
}
