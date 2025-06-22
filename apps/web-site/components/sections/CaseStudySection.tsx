'use client';

import { motion } from 'framer-motion';
import Image from 'next/image';

export default function CaseStudySection() {
  return (
    <section className="py-20 bg-white dark:bg-gray-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          viewport={{ once: true }}
          className="bg-gradient-to-r from-blue-50 to-orange-50 dark:from-gray-700 dark:to-gray-600 rounded-2xl p-8 md:p-12"
        >
          <div className="max-w-4xl mx-auto text-center">
            {/* Company Logo */}
            <div className="mb-8">
              <Image
                src="/mintral-logo.svg"
                alt="Mintral Logistics"
                width={120}
                height={40}
                className="mx-auto"
              />
            </div>

            {/* Quote */}
            <blockquote className="text-2xl md:text-3xl font-light text-gray-800 dark:text-gray-200 mb-8 leading-relaxed">
              <span className="text-6xl text-blue-500 leading-none">&ldquo;</span>
              <em className="italic">
                We cut driver-fatigue incidents by 32% within two weeks of implementing 
                Modular IoT&apos;s real-time monitoring system.
              </em>
              <span className="text-6xl text-blue-500 leading-none">&rdquo;</span>
            </blockquote>

            {/* Attribution */}
            <div className="flex flex-col md:flex-row items-center justify-center gap-4 text-gray-600 dark:text-gray-300">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-blue-500 rounded-full flex items-center justify-center">
                  <span className="text-white font-semibold text-lg">JS</span>
                </div>
                <div className="text-left">
                  <div className="font-semibold text-gray-900 dark:text-white">
                    James Sullivan
                  </div>
                  <div className="text-sm">
                    Director of Fleet Operations
                  </div>
                </div>
              </div>
              <div className="hidden md:block w-px h-12 bg-gray-300 dark:bg-gray-500"></div>
              <div className="text-sm">
                <div className="font-semibold text-gray-900 dark:text-white">
                  Mintral Logistics
                </div>
                <div>
                  2,500+ vehicle fleet
                </div>
              </div>
            </div>

            {/* Results Grid */}
            <div className="grid md:grid-cols-3 gap-8 mt-12 pt-8 border-t border-gray-200 dark:border-gray-500">
              <div className="text-center">
                <div className="text-3xl font-bold text-green-600 dark:text-green-400 mb-2">
                  32%
                </div>
                <p className="text-gray-600 dark:text-gray-300">
                  Reduction in fatigue incidents
                </p>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-blue-600 dark:text-blue-400 mb-2">
                  2 weeks
                </div>
                <p className="text-gray-600 dark:text-gray-300">
                  Time to see results
                </p>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-orange-600 dark:text-orange-400 mb-2">
                  $2.3M
                </div>
                <p className="text-gray-600 dark:text-gray-300">
                  Annual cost savings
                </p>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
} 