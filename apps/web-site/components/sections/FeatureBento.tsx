'use client';

import { motion } from 'framer-motion';
import { 
  IoCloudUpload, 
  IoAnalytics, 
  IoGitNetwork, 
  IoTrendingUp, 
  IoCode, 
  IoCube,
  IoFlash 
} from 'react-icons/io5';

const features = [
  {
    id: 1,
    title: 'Data Ingestion',
    description: 'Seamlessly collect data from any IoT device, sensor, or gateway with our universal adapters.',
    icon: IoCloudUpload,
    gradient: 'from-blue-500 to-blue-600',
  },
  {
    id: 2,
    title: 'Symptom Engine',
    description: 'AI-powered anomaly detection that learns from your data patterns and alerts you to issues.',
    icon: IoAnalytics,
    gradient: 'from-yellow-500 to-orange-500',
  },
  {
    id: 3,
    title: 'Orchestration',
    description: 'Automate workflows and responses with our flexible orchestration engine.',
    icon: IoGitNetwork,
    gradient: 'from-green-500 to-emerald-600',
  },
  {
    id: 4,
    title: 'Realtime Dashboards',
    description: 'Beautiful, interactive dashboards that update in real-time with your IoT data streams.',
    icon: IoTrendingUp,
    gradient: 'from-purple-500 to-purple-600',
  },
  {
    id: 5,
    title: 'Developer APIs',
    description: 'RESTful APIs and GraphQL endpoints for seamless integration with your existing systems.',
    icon: IoCode,
    gradient: 'from-indigo-500 to-indigo-600',
  },
  {
    id: 6,
    title: 'Open Source Swap-a-Box',
    description: 'Modular architecture lets you swap components without vendor lock-in.',
    icon: IoCube,
    gradient: 'from-gray-600 to-gray-700',
  },
  {
    id: 7,
    title: 'Edge Computing',
    description: 'Deploy processing at the edge for ultra-low latency and offline capabilities.',
    icon: IoFlash,
    gradient: 'from-red-500 to-red-600',
  },
];

export default function FeatureBento() {
  return (
    <section id="features" className="bg-gray-50 dark:bg-gray-800 py-16 sm:py-20">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
          className="mx-auto max-w-2xl text-center mb-12"
        >
          <h2 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-4xl">
            Everything you need for IoT monitoring
          </h2>
          <p className="mt-4 text-lg leading-8 text-gray-600 dark:text-gray-300">
            From data ingestion to real-time insights, Modular IoT provides all the tools you need.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature, index) => (
            <motion.div
              key={feature.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: index * 0.1 }}
              viewport={{ once: true }}
              className={`
                relative bg-white dark:bg-gray-900 p-6 rounded-2xl shadow-sm hover:shadow-lg transition-all duration-300
                ${feature.id === 1 ? 'lg:col-span-2' : ''}
                ${feature.id === 4 ? 'lg:col-span-2' : ''}
              `}
            >
              <div className={`inline-flex p-3 rounded-lg bg-gradient-to-r ${feature.gradient} mb-4`}>
                <feature.icon className="h-6 w-6 text-white" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                {feature.title}
              </h3>
              <p className="text-gray-600 dark:text-gray-300 text-sm leading-relaxed">
                {feature.description}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
} 