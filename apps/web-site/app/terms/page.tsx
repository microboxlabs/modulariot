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
  title: "Terms of Service - Modular IoT",
  description: "Terms of Service for Modular IoT - Rules and guidelines for using our IoT monitoring platform.",
};

export default function TermsOfService() {
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
                <h1 className="text-3xl sm:text-4xl font-bold text-white">Terms of Service</h1>
              </div>
              <p className="mt-4 text-gray-400">Last updated: February 3, 2026</p>
            </header>

            {/* Content */}
            <article className="prose prose-invert prose-lg max-w-none">
              <section className="mb-10">
                <h2 className="text-2xl font-semibold text-blue-400 mb-4">1. Agreement to Terms</h2>
                <p className="text-gray-300 leading-relaxed">
                  These Terms of Service (&quot;Terms&quot;) constitute a legally binding agreement between you and MicroboxLabs (&quot;we,&quot; &quot;us,&quot; or &quot;our&quot;) governing your access to and use of the Modular IoT platform, including our website, APIs, software, and related services (collectively, the &quot;Services&quot;). By accessing or using the Services, you agree to be bound by these Terms. If you do not agree to these Terms, you may not use the Services.
                </p>
              </section>

              <section className="mb-10">
                <h2 className="text-2xl font-semibold text-blue-400 mb-4">2. Eligibility</h2>
                <p className="text-gray-300 leading-relaxed">
                  You must be at least 18 years of age and have the legal capacity to enter into a binding contract to use the Services. If you are using the Services on behalf of an organization, you represent that you have the authority to bind that organization to these Terms. The Services are not intended for use in any jurisdiction where such use would be prohibited.
                </p>
              </section>

              <section className="mb-10">
                <h2 className="text-2xl font-semibold text-blue-400 mb-4">3. Description of Services</h2>
                <p className="text-gray-300 leading-relaxed">
                  Modular IoT is an open-source IoT monitoring platform that enables real-time fleet monitoring, device telemetry, and related analytics. We may offer both self-hosted software (under applicable open-source licenses) and hosted services. We reserve the right to modify, suspend, or discontinue any part of the Services at any time, with or without notice.
                </p>
              </section>

              <section className="mb-10">
                <h2 className="text-2xl font-semibold text-blue-400 mb-4">4. Account Registration and Security</h2>
                <p className="text-gray-300 mb-4">When you create an account, you agree to:</p>
                <ul className="list-disc list-inside text-gray-300 space-y-2 ml-4">
                  <li>Provide accurate, current, and complete registration information</li>
                  <li>Maintain and promptly update your account information</li>
                  <li>Keep your password and account credentials confidential</li>
                  <li>Accept responsibility for all activities that occur under your account</li>
                  <li>Notify us immediately of any unauthorized use of your account</li>
                </ul>
                <p className="text-gray-300 mt-4">
                  We are not liable for any loss or damage arising from your failure to protect your account credentials.
                </p>
              </section>

              <section className="mb-10">
                <h2 className="text-2xl font-semibold text-blue-400 mb-4">5. Acceptable Use</h2>
                <p className="text-gray-300 mb-4">You agree not to use the Services to:</p>
                <ul className="list-disc list-inside text-gray-300 space-y-2 ml-4">
                  <li>Violate any applicable law, regulation, or third-party rights</li>
                  <li>Transmit malicious code, malware, or any harmful or illegal content</li>
                  <li>Attempt to gain unauthorized access to our systems, networks, or other users&apos; accounts</li>
                  <li>Interfere with or disrupt the integrity or performance of the Services</li>
                  <li>Use the Services for any purpose that is fraudulent, abusive, or infringes intellectual property rights</li>
                  <li>Resell, sublicense, or commercially exploit the Services without our prior written consent (except as permitted by applicable open-source licenses)</li>
                  <li>Collect or harvest data from the Services using automated means (e.g., scrapers, bots) beyond permitted API usage</li>
                </ul>
                <p className="text-gray-300 mt-4">
                  We may suspend or terminate your access to the Services if we reasonably believe you have violated these Terms or engaged in conduct that harms the Services or other users.
                </p>
              </section>

              <section className="mb-10">
                <h2 className="text-2xl font-semibold text-blue-400 mb-4">6. Your Data and Content</h2>
                <p className="text-gray-300 mb-4">
                  You retain ownership of any data, content, or materials you submit or transmit through the Services (&quot;Your Content&quot;). By using the Services, you grant us a limited, non-exclusive, royalty-free license to use, process, store, and display Your Content solely to provide, maintain, and improve the Services. Our use of Your Content is also governed by our <Link href="/privacy" className="text-blue-400 hover:text-blue-300">Privacy Policy</Link>.
                </p>
                <p className="text-gray-300">
                  You are solely responsible for Your Content and for ensuring it complies with these Terms and applicable law. We do not endorse and assume no liability for Your Content.
                </p>
              </section>

              <section className="mb-10">
                <h2 className="text-2xl font-semibold text-blue-400 mb-4">7. Intellectual Property</h2>
                <p className="text-gray-300 leading-relaxed">
                  Except for Your Content and except as set forth in applicable open-source licenses, we and our licensors own all right, title, and interest in and to the Services, including all software, designs, trademarks, and documentation. You may not copy, modify, distribute, or create derivative works of our proprietary materials without our express written permission. Open-source components included in our software are subject to their respective licenses.
                </p>
              </section>

              <section className="mb-10">
                <h2 className="text-2xl font-semibold text-blue-400 mb-4">8. Fees and Payment</h2>
                <p className="text-gray-300 leading-relaxed">
                  Some parts of the Services may be subject to fees. If you choose a paid plan, you agree to pay all applicable fees as described at the time of purchase. Fees are generally billed in advance and are non-refundable except as required by law or as explicitly stated in our refund policy. We may change our fees upon reasonable notice. Failure to pay may result in suspension or termination of your access to paid features.
                </p>
              </section>

              <section className="mb-10">
                <h2 className="text-2xl font-semibold text-blue-400 mb-4">9. Disclaimers</h2>
                <p className="text-gray-300 leading-relaxed">
                  THE SERVICES ARE PROVIDED &quot;AS IS&quot; AND &quot;AS AVAILABLE&quot; WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT. WE DO NOT WARRANT THAT THE SERVICES WILL BE UNINTERRUPTED, ERROR-FREE, OR SECURE. YOUR USE OF THE SERVICES IS AT YOUR SOLE RISK. WE ARE NOT RESPONSIBLE FOR THE ACCURACY, RELIABILITY, OR AVAILABILITY OF DATA TRANSMITTED THROUGH IoT DEVICES OR THIRD-PARTY INTEGRATIONS.
                </p>
              </section>

              <section className="mb-10">
                <h2 className="text-2xl font-semibold text-blue-400 mb-4">10. Limitation of Liability</h2>
                <p className="text-gray-300 leading-relaxed">
                  TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, MICROBOXLABS AND ITS AFFILIATES, OFFICERS, DIRECTORS, EMPLOYEES, AND AGENTS SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR ANY LOSS OF PROFITS, DATA, OR GOODWILL, ARISING OUT OF OR IN CONNECTION WITH YOUR USE OF THE SERVICES OR THESE TERMS, WHETHER BASED ON WARRANTY, CONTRACT, TORT, OR ANY OTHER LEGAL THEORY. OUR TOTAL AGGREGATE LIABILITY SHALL NOT EXCEED THE GREATER OF (A) THE AMOUNT YOU PAID US IN THE TWELVE (12) MONTHS PRECEDING THE CLAIM, OR (B) ONE HUNDRED U.S. DOLLARS ($100). SOME JURISDICTIONS DO NOT ALLOW THE EXCLUSION OR LIMITATION OF CERTAIN DAMAGES; IN SUCH JURISDICTIONS, OUR LIABILITY SHALL BE LIMITED TO THE MAXIMUM EXTENT PERMITTED BY LAW.
                </p>
              </section>

              <section className="mb-10">
                <h2 className="text-2xl font-semibold text-blue-400 mb-4">11. Indemnification</h2>
                <p className="text-gray-300 leading-relaxed">
                  You agree to indemnify, defend, and hold harmless MicroboxLabs and its affiliates, officers, directors, employees, and agents from and against any claims, damages, losses, liabilities, costs, and expenses (including reasonable attorneys&apos; fees) arising out of or related to (a) your use of the Services, (b) Your Content, (c) your violation of these Terms or any applicable law, or (d) your violation of any third-party rights.
                </p>
              </section>

              <section className="mb-10">
                <h2 className="text-2xl font-semibold text-blue-400 mb-4">12. Termination</h2>
                <p className="text-gray-300 leading-relaxed">
                  You may stop using the Services at any time. We may suspend or terminate your access to the Services, with or without cause or notice, including for violation of these Terms. Upon termination, your right to use the Services ceases immediately. Provisions that by their nature should survive termination (including ownership, disclaimers, indemnification, and limitation of liability) shall survive.
                </p>
              </section>

              <section className="mb-10">
                <h2 className="text-2xl font-semibold text-blue-400 mb-4">13. Governing Law and Disputes</h2>
                <p className="text-gray-300 leading-relaxed">
                  These Terms shall be governed by and construed in accordance with the laws of the jurisdiction in which MicroboxLabs is established, without regard to its conflict of law provisions. Any dispute arising out of or relating to these Terms or the Services shall be resolved exclusively in the courts of that jurisdiction, and you consent to the personal jurisdiction of such courts.
                </p>
              </section>

              <section className="mb-10">
                <h2 className="text-2xl font-semibold text-blue-400 mb-4">14. Changes to the Terms</h2>
                <p className="text-gray-300 leading-relaxed">
                  We may modify these Terms from time to time. We will notify you of material changes by posting the updated Terms on this page and updating the &quot;Last updated&quot; date. Your continued use of the Services after such changes constitutes acceptance of the revised Terms. If you do not agree to the new Terms, you must stop using the Services.
                </p>
              </section>

              <section className="mb-10">
                <h2 className="text-2xl font-semibold text-blue-400 mb-4">15. General</h2>
                <p className="text-gray-300 mb-4">
                  These Terms, together with our Privacy Policy and any other policies or guidelines we publish, constitute the entire agreement between you and MicroboxLabs regarding the Services. If any provision of these Terms is held to be unenforceable, the remaining provisions will remain in full force and effect. Our failure to enforce any right or provision shall not constitute a waiver of such right or provision.
                </p>
              </section>

              <section className="mb-10">
                <h2 className="text-2xl font-semibold text-blue-400 mb-4">16. Contact Us</h2>
                <p className="text-gray-300 leading-relaxed">
                  If you have any questions about these Terms of Service, please contact us:
                </p>
                <div className="mt-4 p-6 bg-gray-800/50 rounded-lg border border-gray-700">
                  <p className="text-white font-semibold">MicroboxLabs</p>
                  <p className="text-gray-300 mt-2">Email: <a href="mailto:legal@modulariot.com" className="text-blue-400 hover:text-blue-300">legal@modulariot.com</a></p>
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
                  <Link href="/privacy" className="hover:text-white transition-colors">Privacy</Link>
                  <Link href="/terms" className="text-blue-400">Terms</Link>
                </div>
              </div>
            </footer>
          </div>
        </div>
      </body>
    </html>
  );
}
