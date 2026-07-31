import { LegalPageLayout } from "../../components/legal/LegalPageLayout";

export const metadata = {
  title: "Privacy Policy - ModularIoT",
  description: "Privacy Policy for ModularIoT - Learn how we collect, use, and protect your data.",
};

export default function PrivacyPolicy() {
  return (
    <LegalPageLayout title="Privacy Policy" lastUpdated="February 3, 2026" activeLink="privacy">
      <section className="mb-10">
        <h2 className="text-2xl font-semibold text-accent mb-4">1. Introduction</h2>
        <p className="text-ink-2 leading-relaxed">
          Welcome to ModularIoT, operated by MicroboxLabs (&quot;we,&quot; &quot;us,&quot; or &quot;our&quot;). We are committed to protecting your privacy and ensuring the security of your personal information. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our open-source IoT monitoring platform and related services.
        </p>
      </section>

      <section className="mb-10">
        <h2 className="text-2xl font-semibold text-accent mb-4">2. Information We Collect</h2>

        <h3 className="text-xl font-medium text-ink-1 mt-6 mb-3">2.1 Information You Provide</h3>
        <ul className="list-disc list-inside text-ink-2 space-y-2 ml-4">
          <li><strong className="text-ink-1">Account Information:</strong> When you create an account, we collect your name, email address, and password.</li>
          <li><strong className="text-ink-1">Contact Information:</strong> When you contact us or sign up for notifications, we collect your email address and any information you choose to provide.</li>
          <li><strong className="text-ink-1">Payment Information:</strong> For paid services, we collect billing details through our secure payment processors.</li>
          <li><strong className="text-ink-1">Communication Data:</strong> When you communicate with us, we may keep records of those communications.</li>
        </ul>

        <h3 className="text-xl font-medium text-ink-1 mt-6 mb-3">2.2 Information Collected Automatically</h3>
        <ul className="list-disc list-inside text-ink-2 space-y-2 ml-4">
          <li><strong className="text-ink-1">Device Data:</strong> IoT device identifiers, GPS coordinates, sensor readings, and telemetry data you choose to transmit through our platform.</li>
          <li><strong className="text-ink-1">Usage Data:</strong> Information about how you interact with our services, including access times, pages viewed, and features used.</li>
          <li><strong className="text-ink-1">Log Data:</strong> Server logs that may include IP addresses, browser type, operating system, and referring URLs.</li>
          <li><strong className="text-ink-1">Cookies and Similar Technologies:</strong> We use cookies and similar tracking technologies to enhance your experience.</li>
        </ul>
      </section>

      <section className="mb-10">
        <h2 className="text-2xl font-semibold text-accent mb-4">3. How We Use Your Information</h2>
        <p className="text-ink-2 mb-4">We use the information we collect to:</p>
        <ul className="list-disc list-inside text-ink-2 space-y-2 ml-4">
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
        <h2 className="text-2xl font-semibold text-accent mb-4">4. Data Sharing and Disclosure</h2>
        <p className="text-ink-2 mb-4">We may share your information in the following circumstances:</p>
        <ul className="list-disc list-inside text-ink-2 space-y-2 ml-4">
          <li><strong className="text-ink-1">Service Providers:</strong> With third-party vendors who perform services on our behalf (hosting, analytics, payment processing).</li>
          <li><strong className="text-ink-1">Business Transfers:</strong> In connection with a merger, acquisition, or sale of assets.</li>
          <li><strong className="text-ink-1">Legal Requirements:</strong> When required by law, court order, or governmental authority.</li>
          <li><strong className="text-ink-1">Protection of Rights:</strong> To protect the rights, property, or safety of ModularIoT, our users, or others.</li>
          <li><strong className="text-ink-1">With Your Consent:</strong> When you have given us explicit permission to share your information.</li>
        </ul>
        <p className="text-ink-2 mt-4">
          <strong className="text-ink-1">We do not sell your personal information to third parties.</strong>
        </p>
      </section>

      <section className="mb-10">
        <h2 className="text-2xl font-semibold text-accent mb-4">5. Data Security</h2>
        <p className="text-ink-2 leading-relaxed">
          We implement industry-standard security measures to protect your data, including encryption in transit (TLS/SSL) and at rest, access controls, regular security audits, and secure data centers. However, no method of transmission over the Internet or electronic storage is 100% secure, and we cannot guarantee absolute security.
        </p>
      </section>

      <section className="mb-10">
        <h2 className="text-2xl font-semibold text-accent mb-4">6. Data Retention</h2>
        <p className="text-ink-2 leading-relaxed">
          We retain your personal information for as long as necessary to fulfill the purposes outlined in this Privacy Policy, unless a longer retention period is required by law. IoT telemetry data retention periods may vary based on your subscription plan and can be configured according to your preferences.
        </p>
      </section>

      <section className="mb-10">
        <h2 className="text-2xl font-semibold text-accent mb-4">7. Your Rights and Choices</h2>
        <p className="text-ink-2 mb-4">Depending on your location, you may have the following rights:</p>
        <ul className="list-disc list-inside text-ink-2 space-y-2 ml-4">
          <li><strong className="text-ink-1">Access:</strong> Request access to the personal information we hold about you.</li>
          <li><strong className="text-ink-1">Correction:</strong> Request correction of inaccurate or incomplete data.</li>
          <li><strong className="text-ink-1">Deletion:</strong> Request deletion of your personal information.</li>
          <li><strong className="text-ink-1">Portability:</strong> Request a copy of your data in a structured, machine-readable format.</li>
          <li><strong className="text-ink-1">Objection:</strong> Object to certain processing of your data.</li>
          <li><strong className="text-ink-1">Withdrawal of Consent:</strong> Withdraw consent where processing is based on consent.</li>
        </ul>
        <p className="text-ink-2 mt-4">
          To exercise these rights, please contact us at <a href="mailto:privacy@modulariot.com" className="text-accent hover:text-accent-strong">privacy@modulariot.com</a>.
        </p>
      </section>

      <section className="mb-10">
        <h2 className="text-2xl font-semibold text-accent mb-4">8. International Data Transfers</h2>
        <p className="text-ink-2 leading-relaxed">
          Your information may be transferred to and processed in countries other than your country of residence. These countries may have different data protection laws. We ensure appropriate safeguards are in place for such transfers, including standard contractual clauses approved by relevant authorities.
        </p>
      </section>

      <section className="mb-10">
        <h2 className="text-2xl font-semibold text-accent mb-4">9. Children&apos;s Privacy</h2>
        <p className="text-ink-2 leading-relaxed">
          Our services are not directed to individuals under the age of 16. We do not knowingly collect personal information from children. If you believe we have inadvertently collected information from a child, please contact us immediately, and we will take steps to delete such information.
        </p>
      </section>

      <section className="mb-10">
        <h2 className="text-2xl font-semibold text-accent mb-4">10. Open Source Considerations</h2>
        <p className="text-ink-2 leading-relaxed">
          ModularIoT is an open-source platform. When you self-host our software, you are responsible for data collection and privacy practices on your own infrastructure. This Privacy Policy applies only to services hosted and operated directly by MicroboxLabs.
        </p>
      </section>

      <section className="mb-10">
        <h2 className="text-2xl font-semibold text-accent mb-4">11. Changes to This Policy</h2>
        <p className="text-ink-2 leading-relaxed">
          We may update this Privacy Policy from time to time. We will notify you of any material changes by posting the new Privacy Policy on this page and updating the &quot;Last updated&quot; date. We encourage you to review this Privacy Policy periodically.
        </p>
      </section>

      <section className="mb-10">
        <h2 className="text-2xl font-semibold text-accent mb-4">12. Contact Us</h2>
        <p className="text-ink-2 leading-relaxed">
          If you have any questions about this Privacy Policy or our data practices, please contact us:
        </p>
        <div className="mt-4 p-6 bg-surface-2 rounded-lg border border-hairline">
          <p className="text-ink-1 font-semibold">MicroboxLabs</p>
          <p className="text-ink-2 mt-2">Email: <a href="mailto:privacy@modulariot.com" className="text-accent hover:text-accent-strong">privacy@modulariot.com</a></p>
          <p className="text-ink-2">General Inquiries: <a href="mailto:hello@modulariot.com" className="text-accent hover:text-accent-strong">hello@modulariot.com</a></p>
          <p className="text-ink-2">GitHub: <a href="https://github.com/microboxlabs" className="text-accent hover:text-accent-strong" target="_blank" rel="noopener noreferrer">github.com/microboxlabs</a></p>
        </div>
      </section>
    </LegalPageLayout>
  );
}
