import { ThemeModeScript } from "flowbite-react";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

export const metadata = {
  title: "ModularIoT — De detectar desviaciones a reducirlas",
  description:
    "Convertimos cada señal de tu flota en menos desviaciones repetidas. Los datos y las decisiones son tuyos.",
  robots: { index: false, follow: false },
};

export default function ComingSoon() {
  return (
    <html lang="es" suppressHydrationWarning className={inter.variable}>
      <head>
        <ThemeModeScript />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </head>
      <body className="min-h-screen bg-gray-950 font-sans text-white antialiased">
        <div className="flex min-h-screen flex-col items-center justify-center px-4 py-16 text-center sm:px-6">
          <div className="w-full max-w-xl">
            {/* Wordmark */}
            <div className="mb-10 flex items-center justify-center gap-2">
              <img src="/headlogo-dark.svg" alt="ModularIoT" className="h-8 w-auto" />
              <span className="text-2xl font-bold tracking-tight">
                Modular<span className="text-yellow-400">IoT</span>
              </span>
            </div>

            <span className="inline-block rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-xs font-medium text-gray-300">
              Código Abierto · Apache-2.0
            </span>

            <h1 className="mt-6 text-4xl font-extrabold tracking-tight sm:text-5xl">
              De detectar desviaciones a{" "}
              <span className="relative inline-block">
                <span aria-hidden className="absolute inset-x-0 bottom-1 top-[0.18em] -z-0 -rotate-1 rounded bg-blue-600/30" />
                <span className="relative">reducirlas</span>
              </span>
            </h1>

            <p className="mx-auto mt-6 max-w-lg text-lg leading-relaxed text-gray-300">
              No vendemos más alertas: convertimos cada señal de tu flota en menos problemas repetidos.
              Los datos y las decisiones son tuyos.
            </p>

            <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <a
                href="/alpha-2506/es"
                className="w-full rounded-lg bg-blue-600 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue-700 sm:w-auto"
              >
                Explorar la plataforma
              </a>
              <a
                href="/alpha-2506/es/contacto?intent=demo"
                className="w-full rounded-lg border border-white/15 px-6 py-3 text-sm font-semibold text-white transition-colors hover:border-white/40 sm:w-auto"
              >
                Agenda un demo
              </a>
            </div>

            {/* Social */}
            <div className="mt-14 flex items-center justify-center gap-6">
              <a href="https://github.com/microboxlabs" aria-label="GitHub" className="text-gray-400 transition-colors hover:text-white">
                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                  <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
                </svg>
              </a>
              <a href="https://x.com/microboxlabs" aria-label="X" className="text-gray-400 transition-colors hover:text-white">
                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M13.795 10.533 20.68 2h-3.073l-5.255 6.517L7.69 2H1l7.806 10.91L1.47 22h3.074l5.705-7.07L15.31 22H22l-8.205-11.467Zm-2.38 2.95L9.97 11.464 4.36 3.627h2.31l4.528 6.317 1.443 2.02 6.018 8.409h-2.31l-4.934-6.89Z" />
                </svg>
              </a>
            </div>

            <div className="mt-10 text-xs text-gray-500">
              <p>© {new Date().getFullYear()} MicroBox Labs · Logística minera</p>
              <div className="mt-3 flex justify-center gap-4">
                <a href="/privacy" className="transition-colors hover:text-white">Privacidad</a>
                <a href="/terms" className="transition-colors hover:text-white">Términos</a>
              </div>
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}
