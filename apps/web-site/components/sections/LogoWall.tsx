'use client';

import Image from 'next/image';

const logos = [
  { name: 'Mintral', src: '/mintral-logo.svg' },
  { name: 'TechCorp', src: '/logo.svg' },
  { name: 'DataFlow', src: '/logo.svg' },
  { name: 'IoT Systems', src: '/logo.svg' },
  { name: 'EdgeCompute', src: '/logo.svg' },
  { name: 'CloudVision', src: '/logo.svg' },
  { name: 'SmartSensor', src: '/logo.svg' },
  { name: 'AutoFlow', src: '/logo.svg' },
];

export default function LogoWall() {
  return (
    <section className="bg-white dark:bg-gray-900 py-12 sm:py-16">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto max-w-2xl lg:max-w-none">
          <h2 className="text-lg font-semibold leading-8 text-gray-900 dark:text-white text-center mb-8">
            Trusted by teams at leading companies
          </h2>
          <div className="relative overflow-hidden">
            <div className="flex animate-[scroll_20s_linear_infinite] space-x-8">
              {[...logos, ...logos].map((logo, index) => (
                <div
                  key={`${logo.name}-${index}`}
                  className="flex-shrink-0 flex items-center justify-center w-32 h-16 grayscale hover:grayscale-0 transition-all duration-300"
                >
                  <Image
                    src={logo.src}
                    alt={logo.name}
                    width={128}
                    height={64}
                    className="max-h-12 w-auto object-contain"
                    loading="lazy"
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      <style jsx>{`
        @keyframes scroll {
          0% {
            transform: translateX(0);
          }
          100% {
            transform: translateX(-50%);
          }
        }
      `}</style>
    </section>
  );
} 