import Image from "next/image";

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center gap-8 px-6 text-center">
      <Image
        src="/brand/logo.svg"
        alt="Modular IoT"
        width={120}
        height={120}
        priority
      />
      <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
        Open-source real-time monitoring,{" "}
        <span className="text-blue-500">built around symptoms.</span>
      </h1>
      <p className="max-w-xl text-lg text-gray-600 dark:text-gray-300">
        Modular IoT turns raw telemetry into operational symptoms, and symptoms
        into action.
      </p>
      <p className="text-sm text-gray-400">
        Phase 0 placeholder — proper hero ships in P1-03.
      </p>
    </main>
  );
}
