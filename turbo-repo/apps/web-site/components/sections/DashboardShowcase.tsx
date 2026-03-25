'use client';

import Image from 'next/image';
import { motion } from 'framer-motion';
import { 
  IoCheckmark, 
  IoMap, 
  IoAnalytics, 
  IoNotifications,
  IoTrendingUp,
  IoEye
} from 'react-icons/io5';

const features = [
  {
    icon: IoMap,
    title: 'Interactive Maps',
    description: 'Visualize your IoT fleet on beautiful, interactive maps with real-time updates.',
  },
  {
    icon: IoAnalytics,
    title: 'Smart Analytics',
    description: 'AI-powered insights help you understand patterns and optimize performance.',
  },
  {
    icon: IoNotifications,
    title: 'Intelligent Symptoms',
    description: 'Get notified about issues before they become critical problems.',
  },
  {
    icon: IoTrendingUp,
    title: 'Performance Metrics',
    description: 'Track KPIs and trends with customizable charts and visualizations.',
  },
  {
    icon: IoEye,
    title: 'Real-time Monitoring',
    description: 'Monitor your entire fleet in real-time with sub-second data updates.',
  },
];

export default function DashboardShowcase() {
  return (
    <section id="architecture" className="bg-gray-50 dark:bg-gray-800 py-16 sm:py-20">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
          className="mx-auto max-w-2xl text-center mb-12"
        >
          <h2 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-4xl">
            Beautiful dashboards that actually work
          </h2>
          <p className="mt-4 text-lg leading-8 text-gray-600 dark:text-gray-300">
            Monitor your IoT infrastructure with stunning visualizations designed for real-world operations
          </p>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          {/* Screenshots */}
          <motion.div
            initial={{ opacity: 0, x: -50 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
            className="space-y-6"
          >
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl transform rotate-1"></div>
              <div className="relative bg-white dark:bg-gray-900 rounded-2xl p-2 shadow-2xl">
                <Image
                  src="/demo/dashboard-map.png"
                  alt="Interactive IoT fleet map dashboard"
                  width={600}
                  height={400}
                  className="w-full h-auto rounded-xl"
                  loading="lazy"
                  placeholder="blur"
                  blurDataURL="data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAAIAAoDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAhEAACAQMDBQAAAAAAAAAAAAABAgMABAUGIWGRkbHB0f/EABUBAQEAAAAAAAAAAAAAAAAAAAMF/8QAGhEAAgIDAAAAAAAAAAAAAAAAAAECEgMRkf/aAAwDAQACEQMRAD8AltJagyeH0AthI5xdrLcNM91BF5pX2HaH9bcfaSXWGaRmknyJckliyjqTzSlT54b6bk+h0R//2Q=="
                />
              </div>
            </div>
            
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-green-600 to-blue-600 rounded-2xl transform -rotate-1"></div>
              <div className="relative bg-white dark:bg-gray-900 rounded-2xl p-2 shadow-2xl">
                <Image
                  src="/demo/symptom-timeline.png"
                  alt="Symptom detection timeline dashboard"
                  width={600}
                  height={300}
                  className="w-full h-auto rounded-xl"
                  loading="lazy"
                  placeholder="blur"
                  blurDataURL="data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAAIAAoDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAhEAACAQMDBQAAAAAAAAAAAAABAgMABAUGIWGRkbHB0f/EABUBAQEAAAAAAAAAAAAAAAAAAAMF/8QAGhEAAgIDAAAAAAAAAAAAAAAAAAECEgMRkf/aAAwDAQACEQMRAD8AltJagyeH0AthI5xdrLcNM91BF5pX2HaH9bcfaSXWGaRmknyJckliyjqTzSlT54b6bk+h0R//2Q=="
                />
              </div>
            </div>
          </motion.div>

          {/* Features List */}
          <motion.div
            initial={{ opacity: 0, x: 50 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            viewport={{ once: true }}
            className="space-y-6"
          >
            <div className="space-y-6">
              {features.map((feature, index) => (
                <motion.div
                  key={feature.title}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: index * 0.1 }}
                  viewport={{ once: true }}
                  className="flex items-start space-x-4"
                >
                  <div className="flex-shrink-0">
                    <div className="flex items-center justify-center w-10 h-10 bg-blue-100 dark:bg-blue-900 rounded-lg">
                      <feature.icon className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                    </div>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
                      {feature.title}
                    </h3>
                    <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
                      {feature.description}
                    </p>
                  </div>
                </motion.div>
              ))}
            </div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.5 }}
              viewport={{ once: true }}
              className="pt-6"
            >
              <div className="flex items-center space-x-2 text-green-600 dark:text-green-400">
                <IoCheckmark className="w-5 h-5" />
                <span className="font-medium">Zero configuration required</span>
              </div>
              <div className="flex items-center space-x-2 text-green-600 dark:text-green-400 mt-2">
                <IoCheckmark className="w-5 h-5" />
                <span className="font-medium">Works with any IoT protocol</span>
              </div>
              <div className="flex items-center space-x-2 text-green-600 dark:text-green-400 mt-2">
                <IoCheckmark className="w-5 h-5" />
                <span className="font-medium">Scales from 10 to 10M+ devices</span>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </div>
    </section>
  );
} 