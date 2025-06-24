'use client'

import Image from 'next/image'
import { motion } from 'framer-motion'
import { Quote } from 'lucide-react'

export default function MarketingPanel() {
  return (
    <div className="hidden sm:flex flex-col items-center justify-center p-8 bg-blue-50 dark:bg-slate-900">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="max-w-md text-center space-y-6"
      >
        <div className="flex justify-center">
          <Image
            src="/logo.svg"
            alt="ModularIoT"
            width={160}
            height={60}
            className="dark:invert"
          />
        </div>
        
        <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-gray-900 dark:text-white">
          Monitor IoT fleets in real-time.
        </h1>
        
        <p className="text-sm text-gray-600 dark:text-gray-300">
          Symptom-driven alerts, usage-based billing, OSS.
        </p>
        
        <div className="mt-8 p-4 bg-white/50 dark:bg-slate-800/50 rounded-lg border border-gray-200 dark:border-slate-700">
          <div className="flex items-start space-x-3">
            <Quote className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
            <div className="text-sm">
              <p className="text-gray-700 dark:text-gray-300 italic">
                "ModularIoT helped us reduce our monitoring costs by 60% while improving our fleet visibility."
              </p>
              <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                — Sarah Chen, IoT Operations Lead
              </p>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  )
}