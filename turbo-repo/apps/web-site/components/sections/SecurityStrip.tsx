'use client';

import { IoShieldCheckmark, IoDocument, IoEarth } from 'react-icons/io5';

const certifications = [
  {
    id: 1,
    title: 'SOC 2 Type 2',
    description: 'Security, Availability & Processing Integrity',
    icon: IoShieldCheckmark,
  },
  {
    id: 2,
    title: 'ISO 27001',
    description: 'Information Security Management',
    icon: IoDocument,
  },
  {
    id: 3,
    title: 'GDPR Ready',
    description: 'Data Protection & Privacy Compliance',
    icon: IoEarth,
  },
];

export default function SecurityStrip() {
  return (
    <section className="bg-gray-900 dark:bg-gray-950 py-8">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row items-center justify-center space-y-4 sm:space-y-0 sm:space-x-12">
          <div className="text-center sm:text-left">
            <h3 className="text-sm font-semibold text-white mb-1">
              Enterprise Security & Compliance
            </h3>
            <p className="text-xs text-gray-400">
              Your data is protected with industry-leading security standards
            </p>
          </div>
          
          <div className="flex flex-wrap items-center justify-center gap-6 sm:gap-8">
            {certifications.map((cert) => (
              <div
                key={cert.id}
                className="flex items-center space-x-2 group"
              >
                <cert.icon className="h-5 w-5 text-green-400 group-hover:text-green-300 transition-colors" />
                <div className="text-center sm:text-left">
                  <div className="text-sm font-medium text-white group-hover:text-gray-100 transition-colors">
                    {cert.title}
                  </div>
                  <div className="text-xs text-gray-400 hidden sm:block">
                    {cert.description}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
} 