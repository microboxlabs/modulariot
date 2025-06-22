'use client';

import { motion } from 'framer-motion';
import { 
  IoLogoDocker, 
  IoGitBranch, 
  IoSettings 
} from 'react-icons/io5';

const quickStarts = [
  {
    id: 1,
    title: 'Helm Chart Deployment',
    description: 'Deploy Modular IoT to Kubernetes with our production-ready Helm chart. Includes monitoring and auto-scaling.',
    icon: IoLogoDocker,
    gradient: 'from-blue-500 to-blue-600',
    githubUrl: 'https://github.com/modulariot/helm-charts',
    tags: ['Kubernetes', 'Production', 'Auto-scaling'],
    time: '5 minutes',
  },
  {
    id: 2,
    title: 'Pulsar Connector',
    description: 'Stream IoT data directly to Apache Pulsar for real-time processing and analytics at scale.',
    icon: IoGitBranch,
    gradient: 'from-green-500 to-emerald-600',
    githubUrl: 'https://github.com/modulariot/pulsar-connector',
    tags: ['Pulsar', 'Streaming', 'Real-time'],
    time: '3 minutes',
  },
  {
    id: 3,
    title: 'n8n Workflow',
    description: 'No-code automation workflows for IoT data processing, alerting, and integration with your tools.',
    icon: IoSettings,
    gradient: 'from-purple-500 to-purple-600',
    githubUrl: 'https://github.com/modulariot/n8n-workflows',
    tags: ['No-code', 'Automation', 'Integration'],
    time: '2 minutes',
  },
];

export default function QuickStartGallery() {
  return (
    <section id="quick-start" className="bg-white dark:bg-gray-900 py-16 sm:py-20">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
          className="mx-auto max-w-2xl text-center mb-12"
        >
          <h2 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-4xl">
            Start monitoring in minutes
          </h2>
          <p className="mt-4 text-lg leading-8 text-gray-600 dark:text-gray-300">
            Get up and running quickly with our pre-built templates and integrations
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {quickStarts.map((quickStart, index) => (
            <motion.div
              key={quickStart.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: index * 0.1 }}
              viewport={{ once: true }}
              className="group relative bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm hover:shadow-lg transition-all duration-300 border border-gray-200 dark:border-gray-700"
            >
              <div className="flex items-center justify-between mb-4">
                <div className={`inline-flex p-3 rounded-lg bg-gradient-to-r ${quickStart.gradient}`}>
                  <quickStart.icon className="h-6 w-6 text-white" />
                </div>
                <span className="text-xs font-medium text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded-full">
                  {quickStart.time}
                </span>
              </div>

              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                {quickStart.title}
              </h3>
              
              <p className="text-gray-600 dark:text-gray-300 text-sm leading-relaxed mb-4">
                {quickStart.description}
              </p>

              <div className="flex flex-wrap gap-2 mb-6">
                {quickStart.tags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300"
                  >
                    {tag}
                  </span>
                ))}
              </div>

              <a
                href={quickStart.githubUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center w-full px-4 py-2 text-sm font-medium text-white bg-gray-900 dark:bg-white dark:text-gray-900 rounded-lg hover:bg-gray-800 dark:hover:bg-gray-100 transition-colors group-hover:scale-105 transform duration-300"
              >
                <IoGitBranch className="h-4 w-4 mr-2" />
                View on GitHub
                <svg className="ml-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>
            </motion.div>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          viewport={{ once: true }}
          className="text-center mt-12"
        >
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Need help getting started?{' '}
            <a href="#docs" className="font-medium text-blue-600 dark:text-blue-400 hover:text-blue-500">
              Check out our documentation
            </a>
          </p>
        </motion.div>
      </div>
    </section>
  );
} 