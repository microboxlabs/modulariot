'use client';

import { motion } from 'framer-motion';
import { HiCheck } from 'react-icons/hi';
import CTAButton from '../CTAButton';

export default function PricingSection() {
  const plans = [
    {
      name: "Starter",
      price: "60 UF",
      period: "/month",
      description: "Perfect for small fleets getting started",
      events: "Up to 1M events/month",
      features: [
        "Real-time streaming pipeline",
        "Basic alerting & notifications", 
        "Standard integrations",
        "L1 support included",
        "99.9% uptime SLA"
      ],
      highlight: false
    },
    {
      name: "Growth", 
      price: "Custom",
      period: "",
      description: "Scales with your growing fleet",
      events: "10M+ events/month",
      features: [
        "Advanced analytics & ML",
        "Custom workflow engine",
        "Priority integrations",
        "L2 support + CSM",
        "99.99% uptime SLA",
        "Custom compliance tools"
      ],
      highlight: true
    },
    {
      name: "Enterprise",
      price: "Contact",
      period: "",
      description: "Enterprise-grade with dedicated support",
      events: "Unlimited events/month",
      features: [
        "White-label deployment",
        "Custom feature development",
        "Dedicated infrastructure",
        "24/7 premium support",
        "Custom SLAs",
        "On-premise options"
      ],
      highlight: false
    }
  ];

  return (
    <section id="pricing" className="py-20 bg-white dark:bg-gray-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-4">
            Simple, Transparent Pricing
          </h2>
          <p className="text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto">
            Pay based on usage, not per-seat licenses. Scale as your fleet grows.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-8 mb-16">
          {plans.map((plan, index) => (
            <motion.div
              key={plan.name}
              initial={{ opacity: 0, y: 50 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: index * 0.1 }}
              viewport={{ once: true }}
              className={`relative bg-white dark:bg-gray-700 rounded-2xl shadow-lg overflow-hidden ${
                plan.highlight ? 'ring-2 ring-blue-500 scale-105' : ''
              }`}
            >
              {plan.highlight && (
                <div className="absolute top-0 left-0 right-0 bg-blue-500 text-white text-center py-2 text-sm font-semibold">
                  Most Popular
                </div>
              )}
              
              <div className={`p-8 ${plan.highlight ? 'pt-16' : 'pt-8'}`}>
                <div className="text-center mb-8">
                  <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                    {plan.name}
                  </h3>
                  <div className="text-4xl font-bold text-gray-900 dark:text-white mb-1">
                    {plan.price}
                    <span className="text-lg font-normal text-gray-600 dark:text-gray-300">
                      {plan.period}
                    </span>
                  </div>
                  <p className="text-gray-600 dark:text-gray-300 mb-2">
                    {plan.description}
                  </p>
                  <div className="text-sm font-semibold text-blue-600 dark:text-blue-400">
                    {plan.events}
                  </div>
                </div>

                <ul className="space-y-3 mb-8">
                  {plan.features.map((feature, featureIndex) => (
                    <li key={featureIndex} className="flex items-start">
                      <HiCheck className="h-5 w-5 text-green-500 mr-3 mt-0.5 flex-shrink-0" />
                      <span className="text-gray-700 dark:text-gray-300">{feature}</span>
                    </li>
                  ))}
                </ul>

                <CTAButton 
                  variant={plan.highlight ? "primary" : "secondary"}
                  className="w-full"
                >
                  {plan.name === "Starter" ? "Start Free Trial" : "Get Quote"}
                </CTAButton>
              </div>
            </motion.div>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          viewport={{ once: true }}
          className="text-center"
        >
          <p className="text-gray-600 dark:text-gray-300 mb-4">
            All plans include our core streaming platform and basic integrations.
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            UF = Usage Factor (based on data volume, processing complexity, and storage requirements)
          </p>
        </motion.div>
      </div>
    </section>
  );
} 