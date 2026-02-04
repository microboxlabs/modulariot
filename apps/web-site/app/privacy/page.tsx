import { ThemeModeScript } from "flowbite-react";
import { Inter } from "next/font/google";
import "../globals.css";
import Image from "next/image";
import Link from "next/link";

const inter = Inter({
  subsets: ["latin"],
  display: 'swap',
  variable: '--font-inter',
});

export const metadata = {
  title: "Privacy Policy - Modular IoT",
  description: "Privacy Policy for Modular IoT - Learn how we collect, use, and protect your data.",
};

export default function PrivacyPolicy() {
  return (
    <html lang="en" suppressHydrationWarning className={inter.variable}>
      <head>
        <ThemeModeScript />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </head>
      <body className="font-sans antialiased bg-gradient-to-br from-gray-900 via-blue-900 to-gray-900 text-white min-h-screen">
        <div className="min-h-screen px-4 sm:px-6 lg:px-8 py-12">
          <div className="max-w-4xl mx-auto">
            {/* Header */}
            <header className="mb-12">
              <Link href="/" className="inline-flex items-center space-x-2 text-gray-400 hover:text-white transition-colors duration-200">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                <span>Back to Home</span>
              </Link>
              <div className="mt-8 flex items-center space-x-4">
                <Image 
                  src="/logo.svg" 
                  alt="Modular IoT" 
                  width={48}
                  height={48}
                />
                <h1 className="text-3xl sm:text-4xl font-bold text-white">Privacy Policy</h1>
              </div>
              <p className="mt-4 text-gray-400">Last updated: February 3, 2026</p>
            </header>

            {/* Content */}
            <article className="prose prose-invert prose-lg max-w-none">
              <section className="mb-10">
                <h2 className="text-2xl font-semibold text-blue-400 mb-4">1. Introduction</h2>
                <p className="text-gray-300 leading-relaxed">
                  Welcome to Modular IoT, operated by MicroboxLabs (&quot;we,&quot; &quot;us,&quot; or &quot;our&quot;). We are committed to protecting your privacy and ensuring the security of your personal information. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our open-source IoT monitoring platform and related services.
                </p>
              </section>

              <section className="mb-10">
                <h2 className="text-2xl font-semibold text-blue-400 mb-4">2. Information We Collect</h2>
                
                <h3 className="text-xl font-medium text-white mt-6 mb-3">2.1 Information You Provide</h3>
                <ul className="list-disc list-inside text-gray-300 space-y-2 ml-4">
                  <li><strong className="text-white">Account Information:</strong> When you create an account, we collect your name, email address, and password.</li>
                  <li><strong className="text-white">Contact Information:</strong> When you contact us or sign up for notifications, we collect your email address and any information you choose to provide.</li>
                  <li><strong className="text-white">Payment Information:</strong> For paid services, we collect billing details through our secure payment processors.</li>
                  <li><strong className="text-white">Communication Data:</strong> When you communicate with us, we may keep records of those communications.</li>
                </ul>

                <h3 className="text-xl font-medium text-white mt-6 mb-3">2.2 Information Collected Automatically</h3>
                <ul className="list-disc list-inside text-gray-300 space-y-2 ml-4">
                  <li><strong className="text-white">Device Data:</strong> IoT device identifiers, GPS coordinates, sensor readings, and telemetry data you choose to transmit through our platform.</li>
                  <li><strong className="text-white">Usage Data:</strong> Information about how you interact with our services, including access times, pages viewed, and features used.</li>
                  <li><strong className="text-white">Log Data:</strong> Server logs that may include IP addresses, browser type, operating system, and referring URLs.</li>
                  <li><strong className="text-white">Cookies and Similar Technologies:</strong> We use cookies and similar tracking technologies to enhance your experience.</li>
                </ul>
              </section>

              <section className="mb-10">
                <h2 className="text-2xl font-semibold text-blue-400 mb-4">3. How We Use Your Information</h2>
                <p className="text-gray-300 mb-4">We use the information we collect to:</p>
                <ul className="list-disc list-inside text-gray-300 space-y-2 ml-4">
                  <li>Provide, maintain, and improve our IoT monitoring services</li>
                  <li>Process your transactions and manage your account</li>
                  <li>Send you technical notices, updates, security alerts, and support messages</li>
                  <li>Respond to your comments, questions, and customer service requests</li>
                  <li>Analyze usage patterns to enhance user experience and platform performance</li>
                  <li>Detect, prevent, and address technical issues and security threats</li>
                  <li>Comply with legal obligations and enforce our terms of service</li>
                  <li>Send promotional communications (with your consent, where required)</li>
                </ul>
              </section>

              <section className="mb-10">
                <h2 className="text-2xl font-semibold text-blue-400 mb-4">4. Data Sharing and Disclosure</h2>
                <p className="text-gray-300 mb-4">We may share your information in the following circumstances:</p>
                <ul className="list-disc list-inside text-gray-300 space-y-2 ml-4">
                  <li><strong className="text-white">Service Providers:</strong> With third-party vendors who perform services on our behalf (hosting, analytics, payment processing).</li>
                  <li><strong className="text-white">Business Transfers:</strong> In connection with a merger, acquisition, or sale of assets.</li>
                  <li><strong className="text-white">Legal Requirements:</strong> When required by law, court order, or governmental authority.</li>
                  <li><strong className="text-white">Protection of Rights:</strong> To protect the rights, property, or safety of Modular IoT, our users, or others.</li>
                  <li><strong className="text-white">With Your Consent:</strong> When you have given us explicit permission to share your information.</li>
                </ul>
                <p className="text-gray-300 mt-4">
                  <strong className="text-white">We do not sell your personal information to third parties.</strong>
                </p>
              </section>

              <section className="mb-10">
                <h2 className="text-2xl font-semibold text-blue-400 mb-4">5. Data Security</h2>
                <p className="text-gray-300 leading-relaxed">
                  We implement industry-standard security measures to protect your data, including encryption in transit (TLS/SSL) and at rest, access controls, regular security audits, and secure data centers. However, no method of transmission over the Internet or electronic storage is 100% secure, and we cannot guarantee absolute security.
                </p>
              </section>

              <section className="mb-10">
                <h2 className="text-2xl font-semibold text-blue-400 mb-4">6. Data Retention</h2>
                <p className="text-gray-300 leading-relaxed">
                  We retain your personal information for as long as necessary to fulfill the purposes outlined in this Privacy Policy, unless a longer retention period is required by law. IoT telemetry data retention periods may vary based on your subscription plan and can be configured according to your preferences.
                </p>
              </section>

              <section className="mb-10">
                <h2 className="text-2xl font-semibold text-blue-400 mb-4">7. Your Rights and Choices</h2>
                <p className="text-gray-300 mb-4">Depending on your location, you may have the following rights:</p>
                <ul className="list-disc list-inside text-gray-300 space-y-2 ml-4">
                  <li><strong className="text-white">Access:</strong> Request access to the personal information we hold about you.</li>
                  <li><strong className="text-white">Correction:</strong> Request correction of inaccurate or incomplete data.</li>
                  <li><strong className="text-white">Deletion:</strong> Request deletion of your personal information.</li>
                  <li><strong className="text-white">Portability:</strong> Request a copy of your data in a structured, machine-readable format.</li>
                  <li><strong className="text-white">Objection:</strong> Object to certain processing of your data.</li>
                  <li><strong className="text-white">Withdrawal of Consent:</strong> Withdraw consent where processing is based on consent.</li>
                </ul>
                <p className="text-gray-300 mt-4">
                  To exercise these rights, please contact us at <a href="mailto:privacy@modulariot.com" className="text-blue-400 hover:text-blue-300">privacy@modulariot.com</a>.
                </p>
              </section>

              <section className="mb-10">
                <h2 className="text-2xl font-semibold text-blue-400 mb-4">8. International Data Transfers</h2>
                <p className="text-gray-300 leading-relaxed">
                  Your information may be transferred to and processed in countries other than your country of residence. These countries may have different data protection laws. We ensure appropriate safeguards are in place for such transfers, including standard contractual clauses approved by relevant authorities.
                </p>
              </section>

              <section className="mb-10">
                <h2 className="text-2xl font-semibold text-blue-400 mb-4">9. Children&apos;s Privacy</h2>
                <p className="text-gray-300 leading-relaxed">
                  Our services are not directed to individuals under the age of 16. We do not knowingly collect personal information from children. If you believe we have inadvertently collected information from a child, please contact us immediately, and we will take steps to delete such information.
                </p>
              </section>

              <section className="mb-10">
                <h2 className="text-2xl font-semibold text-blue-400 mb-4">10. Open Source Considerations</h2>
                <p className="text-gray-300 leading-relaxed">
                  Modular IoT is an open-source platform. When you self-host our software, you are responsible for data collection and privacy practices on your own infrastructure. This Privacy Policy applies only to services hosted and operated directly by MicroboxLabs.
                </p>
              </section>

              <section className="mb-10">
                <h2 className="text-2xl font-semibold text-blue-400 mb-4">11. Changes to This Policy</h2>
                <p className="text-gray-300 leading-relaxed">
                  We may update this Privacy Policy from time to time. We will notify you of any material changes by posting the new Privacy Policy on this page and updating the &quot;Last updated&quot; date. We encourage you to review this Privacy Policy periodically.
                </p>
              </section>

              <section className="mb-10">
                <h2 className="text-2xl font-semibold text-blue-400 mb-4">12. Contact Us</h2>
                <p className="text-gray-300 leading-relaxed">
                  If you have any questions about this Privacy Policy or our data practices, please contact us:
                </p>
                <div className="mt-4 p-6 bg-gray-800/50 rounded-lg border border-gray-700">
                  <p className="text-white font-semibold">MicroboxLabs</p>
                  <p className="text-gray-300 mt-2">Email: <a href="mailto:privacy@modulariot.com" className="text-blue-400 hover:text-blue-300">privacy@modulariot.com</a></p>
                  <p className="text-gray-300">General Inquiries: <a href="mailto:hello@modulariot.com" className="text-blue-400 hover:text-blue-300">hello@modulariot.com</a></p>
                  <p className="text-gray-300">GitHub: <a href="https://github.com/microboxlabs" className="text-blue-400 hover:text-blue-300" target="_blank" rel="noopener noreferrer">github.com/microboxlabs</a></p>
                </div>
              </section>
            </article>

            {/* Footer */}
            <footer className="mt-16 pt-8 border-t border-gray-700">
              <div className="flex flex-col sm:flex-row items-center justify-between text-gray-500 text-sm">
                <p>&copy; 2025 MicroboxLabs. All rights reserved.</p>
                <div className="mt-4 sm:mt-0 flex space-x-6">
                  <Link href="/" className="hover:text-white transition-colors">Home</Link>
                  <Link href="/privacy" className="text-blue-400">Privacy</Link>
                </div>
              </div>
            </footer>
          </div>
        </div>
      </body>
    </html>
  );
}
