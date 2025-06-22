import { ThemeModeScript } from "flowbite-react";
import { Inter } from "next/font/google";
import "./globals.css";
import Image from "next/image";

const inter = Inter({
  subsets: ["latin"],
  display: 'swap',
  variable: '--font-inter',
});

export const metadata = {
  title: "Modular IoT - Coming Soon",
  description: "Modular IoT is launching soon. Be the first to experience open-source real-time fleet monitoring.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function ComingSoon() {
  return (
    <html lang="en" suppressHydrationWarning className={inter.variable}>
      <head>
        <ThemeModeScript />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </head>
      <body className="font-sans antialiased bg-gradient-to-br from-gray-900 via-blue-900 to-gray-900 text-white min-h-screen">
        <div className="min-h-screen flex items-center justify-center px-4 sm:px-6 lg:px-8">
          <div className="max-w-lg w-full text-center">
            {/* Logo */}
            <div className="mb-8">
              <Image 
                src="/logo.svg" 
                alt="Modular IoT" 
                className="size-3xs mx-auto"
                width={256}
                height={256}
              />
            </div>
            
            {/* Main heading */}
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent mb-6 lg:h-16">
              Coming Soon
            </h1>
            
            {/* Subtitle */}
            <p className="text-xl sm:text-2xl text-gray-300 mb-8 leading-relaxed">
              We&apos;re building the future of 
              <span className="text-blue-400 font-semibold"> open-source </span>
              real-time fleet monitoring
            </p>
            
            {/* Description */}
            <p className="text-gray-400 mb-12 text-lg leading-relaxed">
              Own your fleet data in real time. Stream every GPS ping, sensor value, and driver event through your cloud in milliseconds.
            </p>
            
            {/* Call to action */}
            <div className="space-y-4">
              <p className="text-gray-300 text-sm">
                Get notified when we launch
              </p>
              <div className="flex flex-col sm:flex-row gap-4 max-w-md mx-auto">
                <input 
                  type="email" 
                  placeholder="Enter your email"
                  className="flex-1 px-4 py-3 rounded-lg bg-gray-800 border border-gray-700 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <button className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-900">
                  Notify Me
                </button>
              </div>
            </div>
            
            {/* Social links */}
            <div className="mt-12 flex justify-center space-x-6">
              <a 
                href="https://github.com/microboxlabs" 
                className="text-gray-400 hover:text-white transition-colors duration-200"
                aria-label="GitHub"
              >
                <svg className="size-6" fill="currentColor" viewBox="0 0 24 24">
                  <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
                </svg>
              </a>
              <a 
                href="https://x.com/microboxlabs" 
                className="text-gray-400 hover:text-white transition-colors duration-200"
                aria-label="X"
              >
                <svg className="size-6" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M13.795 10.533 20.68 2h-3.073l-5.255 6.517L7.69 2H1l7.806 10.91L1.47 22h3.074l5.705-7.07L15.31 22H22l-8.205-11.467Zm-2.38 2.95L9.97 11.464 4.36 3.627h2.31l4.528 6.317 1.443 2.02 6.018 8.409h-2.31l-4.934-6.89Z"/>
                </svg>
              </a>
            </div>
            
            {/* Footer */}
            <div className="mt-16 text-gray-500 text-sm">
              <p>&copy; 2025 MicroboxLabs. Built with passion for open source.</p>
            </div>
          </div>
        </div>
      </body>
    </html>
  );
} 