'use client';

import { motion } from 'framer-motion';
import { HiExclamation, HiCheckCircle } from 'react-icons/hi';

export default function PainOutcomeSection() {
  const painPoints = [
    "Vendor lock-in with expensive monthly SaaS fees",
    "Data trapped in third-party systems you can't control", 
    "Limited customization and integration options",
    "High latency affecting real-time decision making",
    "Compliance issues with data sovereignty requirements"
  ];

  const outcomes = [
    "Own your data pipeline and infrastructure completely",
    "Real-time streaming with <56ms latency guaranteed",
    "Build custom workflows and integrations easily", 
    "Scale without recurring SaaS licensing costs",
    "Meet GDPR and data residency requirements effortlessly"
  ];

  return (
    <section className="bg-gray-900 text-white py-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid md:grid-cols-2 gap-12">
          {/* Pain Column */}
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
            className="space-y-6"
          >
            <h2 className="text-2xl font-bold text-red-400 mb-8">
              Current Pain Points
            </h2>
            <div className="space-y-4">
              {painPoints.map((pain, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, x: -30 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.5, delay: index * 0.1 }}
                  viewport={{ once: true }}
                  className="flex items-start gap-3"
                >
                  <HiExclamation className="h-6 w-6 text-red-400 flex-shrink-0 mt-1" />
                  <p className="text-gray-300 leading-relaxed">{pain}</p>
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* Outcome Column */}
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            viewport={{ once: true }}
            className="space-y-6"
          >
            <h2 className="text-2xl font-bold text-green-400 mb-8">
              With Modular IoT
            </h2>
            <div className="space-y-4">
              {outcomes.map((outcome, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, x: 30 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.5, delay: index * 0.1 }}
                  viewport={{ once: true }}
                  className="flex items-start gap-3"
                >
                  <HiCheckCircle className="h-6 w-6 text-green-400 flex-shrink-0 mt-1" />
                  <p className="text-gray-300 leading-relaxed">{outcome}</p>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
} 