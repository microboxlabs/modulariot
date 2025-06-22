'use client';

import Image from 'next/image';
import { 
  IoHardwareChip, 
  IoCloud, 
  IoWifi, 
  IoGitNetwork 
} from 'react-icons/io5';

const protocols = [
  { name: 'MQTT', icon: IoWifi },
  { name: 'REST', icon: IoGitNetwork },
  { name: 'Pulsar', icon: IoHardwareChip },
  { name: 'WebSocket', icon: IoWifi },
];

const cloudProviders = [
  { name: 'AWS', icon: '/vercel.svg' },
  { name: 'Google Cloud', icon: '/vercel.svg' },
  { name: 'Azure', icon: '/vercel.svg' },
  { name: 'DigitalOcean', icon: '/vercel.svg' },
];

export default function FrameworkBanner() {
  return (
    <section className="bg-white dark:bg-gray-900 py-12 sm:py-16">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="text-center">
          <h2 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-3xl mb-4">
            Use Modular IoT with any fleet hardware & any cloud
          </h2>
          <p className="text-lg text-gray-600 dark:text-gray-300 mb-12">
            Connect seamlessly across protocols and deploy anywhere
          </p>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
            {/* Protocols Section */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6 flex items-center justify-center">
                <IoHardwareChip className="h-5 w-5 mr-2" />
                Supported Protocols
              </h3>
              <div className="flex justify-center items-center space-x-8">
                {protocols.map((protocol) => (
                  <div
                    key={protocol.name}
                    className="flex flex-col items-center p-4 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                  >
                    <protocol.icon className="h-8 w-8 text-blue-600 dark:text-blue-400 mb-2" />
                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                      {protocol.name}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Cloud Providers Section */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6 flex items-center justify-center">
                <IoCloud className="h-5 w-5 mr-2" />
                Cloud Providers
              </h3>
              <div className="flex justify-center items-center space-x-8">
                {cloudProviders.map((provider) => (
                  <div
                    key={provider.name}
                    className="flex flex-col items-center p-4 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                  >
                    <div className="h-8 w-8 mb-2 flex items-center justify-center">
                      <Image
                        src={provider.icon}
                        alt={provider.name}
                        width={32}
                        height={32}
                        className="grayscale hover:grayscale-0 transition-all duration-300"
                        loading="lazy"
                      />
                    </div>
                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                      {provider.name}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-8 text-center">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              ...and many more. No vendor lock-in, ever.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
} 