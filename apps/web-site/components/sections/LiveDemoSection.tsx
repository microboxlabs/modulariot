'use client';

import { motion } from 'framer-motion';
import { Carousel } from 'flowbite-react';

export default function LiveDemoSection() {
  const demos = [
    {
      title: "Driver Fatigue Detection → SMS Alert",
      description: "Real-time monitoring detects fatigue symptoms and instantly notifies supervisors",
      image: "/demo/fatigue-demo.gif",
      placeholder: "🚨 Driver fatigue detected → SMS sent to supervisor in <3s"
    },
    {
      title: "Geofence Breach → Deck.gl Visualization", 
      description: "Live map showing fleet position with instant geofence violation alerts",
      image: "/demo/geofence-demo.gif",
      placeholder: "🗺️ Vehicle exits authorized zone → Real-time map update with alert"
    },
    {
      title: "BPMN Workflow Auto-Advance",
      description: "Automated workflow progression based on sensor data and business rules",
      image: "/demo/workflow-demo.gif", 
      placeholder: "⚡ Maintenance due → Auto-create work order → Schedule technician"
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
            See It In Action
          </h2>
          <p className="text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto">
            Watch real-time demos of how Modular IoT processes and responds to fleet events
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          viewport={{ once: true }}
          className="bg-gray-900 rounded-2xl shadow-2xl overflow-hidden"
        >
          <div className="h-96 md:h-[500px] relative">
            <Carousel className="h-full">
              {demos.map((demo, index) => (
                <div key={index} className="flex h-full items-center justify-center bg-gray-800">
                  <div className="text-center text-white p-8 max-w-4xl">
                    <div className="bg-gray-700 rounded-lg p-8 mb-6 min-h-[200px] flex items-center justify-center">
                      {/* Placeholder for GIF - in production would be actual GIF */}
                      <div className="text-4xl md:text-6xl opacity-50">
                        {demo.placeholder}
                      </div>
                    </div>
                    <h3 className="text-2xl font-bold mb-4">{demo.title}</h3>
                    <p className="text-lg text-gray-300">{demo.description}</p>
                  </div>
                </div>
              ))}
            </Carousel>
          </div>
        </motion.div>

        {/* Demo Stats */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          viewport={{ once: true }}
          className="grid md:grid-cols-3 gap-8 mt-16 text-center"
        >
          <div>
            <div className="text-3xl font-bold text-blue-600 dark:text-blue-400 mb-2">
              &lt;3s
            </div>
            <p className="text-gray-600 dark:text-gray-300">
              Alert response time
            </p>
          </div>
          <div>
            <div className="text-3xl font-bold text-orange-600 dark:text-orange-400 mb-2">
              99.9%
            </div>
            <p className="text-gray-600 dark:text-gray-300">
              Event processing accuracy
            </p>
          </div>
          <div>
            <div className="text-3xl font-bold text-green-600 dark:text-green-400 mb-2">
              24/7
            </div>
            <p className="text-gray-600 dark:text-gray-300">
              Continuous monitoring
            </p>
          </div>
        </motion.div>
      </div>
    </section>
  );
} 