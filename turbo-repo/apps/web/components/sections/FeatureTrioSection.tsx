'use client';

import { motion } from 'framer-motion';
import { useState } from 'react';
import { HiLightningBolt, HiExclamationCircle, HiDocumentText } from 'react-icons/hi';

export default function FeatureTrioSection() {
  const [activeTab, setActiveTab] = useState(0);
  const features = [
    {
      id: 'streaming',
      title: 'Realtime Streaming Pipeline',
      icon: HiLightningBolt,
      code: `// Real-time GPS and sensor data streaming
const pipeline = new StreamProcessor({
  source: 'fleet-telemetry',
  processors: [
    new GPSProcessor(),
    new SensorProcessor(),
    new EventProcessor()
  ],
  sink: 'your-cloud-storage',
  latency: '< 56ms'
});

pipeline.start();
// Stream active: Processing 10K+ events/sec`
    },
    {
      id: 'alerting',
      title: 'Symptom-based Alerting', 
      icon: HiExclamationCircle,
      code: `// Configure intelligent alerting rules
const alertRules = {
  driverFatigue: {
    triggers: ['eye_closure > 3s', 'lane_deviation > 2'],
    actions: ['sms_supervisor', 'audio_alert'],
    priority: 'critical'
  },
  geofenceViolation: {
    triggers: ['location_outside_zone'],
    actions: ['notify_dispatch', 'log_incident'],
    priority: 'high'
  }
};

AlertManager.configure(alertRules);
// 32% reduction in incidents within 2 weeks`
    },
    {
      id: 'workflow',
      title: 'Workflow & Evidence Vault',
      icon: HiDocumentText,
      code: `// Automated workflow engine
const workflow = new BPMNWorkflow({
  triggers: ['incident_detected', 'maintenance_due'],
  steps: [
    'capture_evidence',
    'notify_stakeholders', 
    'create_work_order',
    'schedule_followup'
  ],
  storage: 'evidence_vault',
  retention: '7_years'
});

// Compliance-ready audit trail
workflow.getAuditLog(vehicleId, dateRange);`
    }
  ];

  return (
    <section className="py-20 bg-white dark:bg-gray-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-4">
            Three Core Capabilities
          </h2>
          <p className="text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto">
            Everything you need to process, analyze, and act on fleet data in real-time
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 50 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          viewport={{ once: true }}
        >
          {/* Tab Headers */}
          <div className="flex justify-center mb-8">
            <div className="inline-flex rounded-lg border border-gray-200 dark:border-gray-700 p-1 bg-gray-50 dark:bg-gray-900">
              {features.map((feature, index) => {
                const IconComponent = feature.icon;
                return (
                  <button
                    key={feature.id}
                    onClick={() => setActiveTab(index)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
                      activeTab === index
                        ? 'bg-blue-500 text-white shadow-sm'
                        : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                    }`}
                  >
                    <IconComponent className="h-5 w-5" />
                    <span className="hidden sm:inline">{feature.title}</span>
                    <span className="sm:hidden">{feature.title.split(' ')[0]}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Tab Content */}
          <div className="mt-8">
            <div className="bg-gray-800 rounded-lg p-6 overflow-x-auto">
              <pre className="text-sm text-gray-300 leading-relaxed">
                <code>{features[activeTab].code}</code>
              </pre>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
} 