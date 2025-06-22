'use client';

import { motion } from 'framer-motion';
import Image from 'next/image';

export default function ArchitectureSection() {
  return (
    <section id="architecture" className="py-20 bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-4">
            Architecture Overview
          </h2>
          <p className="text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto">
            See how your data flows from edge devices to your cloud infrastructure in real-time
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          viewport={{ once: true }}
          className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-8 md:p-12"
        >
          <div className="relative w-full">
            <Image
              src="/architecture.svg"
              alt="Modular IoT Architecture Diagram"
              width={800}
              height={400}
              className="w-full h-auto"
              priority
            />
          </div>
          
          <div className="text-center mt-8">
            <p className="text-lg font-semibold text-blue-600 dark:text-blue-400">
              &lt; 56 ms median end-to-end latency
            </p>
            <p className="text-gray-600 dark:text-gray-300 mt-2">
              From sensor reading to your application response
            </p>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          viewport={{ once: true }}
          className="grid md:grid-cols-3 gap-8 mt-16"
        >
          <div className="text-center">
            <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl font-bold text-blue-600 dark:text-blue-400">1</span>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              Data Ingestion
            </h3>
            <p className="text-gray-600 dark:text-gray-300">
              Collect GPS, sensor, and event data from your fleet in real-time
            </p>
          </div>

          <div className="text-center">
            <div className="w-16 h-16 bg-orange-100 dark:bg-orange-900 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl font-bold text-orange-600 dark:text-orange-400">2</span>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              Stream Processing
            </h3>
            <p className="text-gray-600 dark:text-gray-300">
              Process and analyze data streams with sub-second latency
            </p>
          </div>

          <div className="text-center">
            <div className="w-16 h-16 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl font-bold text-green-600 dark:text-green-400">3</span>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              Your Infrastructure
            </h3>
            <p className="text-gray-600 dark:text-gray-300">
              Data flows directly to your database, analytics, and applications
            </p>
          </div>
        </motion.div>
      </div>
    </section>
  );
} 