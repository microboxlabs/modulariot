'use client';

import { motion } from 'framer-motion';
import { useState } from 'react';
import { HiChevronDown } from 'react-icons/hi';

export default function FAQSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const faqs = [
    {
      question: "How does Modular IoT compare to Apache Kafka or Apache Pulsar?",
      answer: "While Kafka and Pulsar are excellent message brokers, Modular IoT is a complete real-time fleet data processing platform. We use proven streaming technologies like Pulsar under the hood, but add fleet-specific processors, ML models, and integrations out of the box. You get enterprise-grade streaming without the complexity of building everything from scratch."
    },
    {
      question: "What about GDPR and data sovereignty requirements?",
      answer: "Data sovereignty is a core principle of our platform. All data processing happens in your chosen region/cloud, and we never store your fleet data on our systems. We provide tools for GDPR compliance including data anonymization, retention policies, and audit trails. Your data stays under your control at all times."
    },
    {
      question: "Can I get a static egress IP for firewall whitelisting?",
      answer: "Yes, we provide static egress IPs for all managed deployments. For your-cloud deployments, you have full control over networking and can configure static IPs as needed. We also support VPC peering and private endpoints for enhanced security."
    },
    {
      question: "What's the difference between Modular IoT and traditional telematics providers?",
      answer: "Traditional telematics providers lock you into their ecosystem with monthly per-vehicle fees and limited customization. Modular IoT gives you the raw streaming infrastructure to build your own solutions. You own the data, control the processing logic, and can integrate with any system. It's the difference between renting and owning."
    },
    {
      question: "How quickly can we get started?",
      answer: "For managed deployments, you can be processing live data within 48 hours. Your-cloud deployments typically take 1-2 weeks including infrastructure setup and integration testing. We provide migration tools and support to help you transition from existing systems with minimal downtime."
    },
    {
      question: "What kind of support do you offer?",
      answer: "All plans include technical support via our portal. Growth plans include a dedicated Customer Success Manager and priority response times. Enterprise customers get 24/7 support with guaranteed SLAs. We also provide professional services for custom integrations and migrations."
    }
  ];

  return (
    <section className="py-20 bg-gray-50 dark:bg-gray-900">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-4">
            Frequently Asked Questions
          </h2>
          <p className="text-xl text-gray-600 dark:text-gray-300">
            Everything you need to know about Modular IoT
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 50 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          viewport={{ once: true }}
          className="space-y-4"
        >
          {faqs.map((faq, index) => (
            <div
              key={index}
              className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700"
            >
              <button
                onClick={() => setOpenIndex(openIndex === index ? null : index)}
                className="w-full px-6 py-4 text-left font-semibold text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors duration-200 flex justify-between items-center"
              >
                <span>{faq.question}</span>
                <HiChevronDown
                  className={`h-5 w-5 text-gray-500 transition-transform duration-200 ${
                    openIndex === index ? 'rotate-180' : ''
                  }`}
                />
              </button>
              {openIndex === index && (
                <div className="px-6 pb-4">
                  <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                    {faq.answer}
                  </p>
                </div>
              )}
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
} 