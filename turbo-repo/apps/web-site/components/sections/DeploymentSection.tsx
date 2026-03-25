'use client';

import { motion } from 'framer-motion';
import { Card } from 'flowbite-react';
import { HiCloud, HiCog, HiLightningBolt } from 'react-icons/hi';

export default function DeploymentSection() {
  const deploymentOptions = [
    {
      title: "Your Cloud",
      icon: HiCloud,
      description: "Complete control with deployment in your AWS, Azure, or GCP infrastructure",
      features: [
        "Full data sovereignty",
        "Custom security policies", 
        "Unlimited scaling",
        "Direct database access"
      ],
      highlight: "Most Popular",
      highlightColor: "bg-blue-500"
    },
    {
      title: "Managed by MBL",
      icon: HiCog,
      description: "We handle infrastructure while you focus on your applications and insights",
      features: [
        "Zero DevOps overhead",
        "24/7 monitoring & support",
        "Automatic updates",
        "SLA guarantees"
      ],
      highlight: "Fastest Setup",
      highlightColor: "bg-green-500"
    },
    {
      title: "Hybrid Edge",
      icon: HiLightningBolt,
      description: "Edge processing for ultra-low latency with cloud backup and analytics",
      features: [
        "Sub-10ms edge processing",
        "Offline capability",
        "Cloud synchronization",
        "Regional compliance"
      ],
      highlight: "Ultra Low Latency",
      highlightColor: "bg-orange-500"
    }
  ];

  return (
    <section className="py-20 bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-4">
            Deployment Options
          </h2>
          <p className="text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto">
            Choose the deployment model that best fits your requirements and compliance needs
          </p>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-8">
          {deploymentOptions.map((option, index) => {
            const IconComponent = option.icon;
            return (
              <motion.div
                key={option.title}
                initial={{ opacity: 0, y: 50 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
                viewport={{ once: true }}
              >
                <Card className="h-full relative hover:shadow-lg transition-shadow duration-300">
                  {/* Highlight Badge */}
                  <div className={`absolute -top-3 left-1/2 transform -translate-x-1/2 ${option.highlightColor} text-white px-4 py-1 rounded-full text-sm font-semibold`}>
                    {option.highlight}
                  </div>
                  
                  <div className="text-center pt-4">
                    <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center mx-auto mb-4">
                      <IconComponent className="h-8 w-8 text-blue-600 dark:text-blue-400" />
                    </div>
                    
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-3">
                      {option.title}
                    </h3>
                    
                    <p className="text-gray-600 dark:text-gray-300 mb-6">
                      {option.description}
                    </p>
                    
                    <ul className="space-y-2 mb-6">
                      {option.features.map((feature, featureIndex) => (
                        <li key={featureIndex} className="flex items-center text-sm text-gray-600 dark:text-gray-300">
                          <div className="w-2 h-2 bg-blue-500 rounded-full mr-3 flex-shrink-0"></div>
                          {feature}
                        </li>
                      ))}
                    </ul>
                    
                    <a
                      href="#pricing"
                      className="text-blue-500 hover:text-blue-600 font-semibold underline underline-offset-4 hover:underline-offset-8 transition-all duration-300"
                    >
                      See reference cost →
                    </a>
                  </div>
                </Card>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
} 