'use client';

import { motion } from 'framer-motion';
import Image from 'next/image';
import CTAButton from '../CTAButton';

interface HeroSectionProps {
  dict: {
    hero: {
      title: string;
      realTime: string;
      saasHandcuffs: string;
      subtitle: string;
      your: string;
      openSourceBadge: string;
      scheduleDemoCTA: string;
      architectureGuide: string;
    };
  };
}

export default function HeroSection({ dict }: HeroSectionProps) {
  const scrollToArchitecture = () => {
    const element = document.getElementById('architecture');
    element?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <section id="hero" className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-blue-50 dark:from-gray-900 dark:to-gray-800 pt-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Left Column - Content */}
          <motion.div
            initial={{ opacity: 0, x: -50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8 }}
            className="space-y-8"
          >
            <div className="space-y-6">
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-gray-900 dark:text-white leading-tight">
                Own your fleet data in{' '}
                <span className="text-blue-500">real time</span>—without{' '}
                <span className="text-orange-500">SaaS handcuffs</span>.
              </h1>
              
              <p className="text-xl text-gray-600 dark:text-gray-300 leading-relaxed">
                Stream every GPS ping, sensor value and driver event through{' '}
                <em className="text-blue-600 dark:text-blue-400 font-semibold">your</em> cloud in milliseconds.
              </p>
              
              <div className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-50 text-blue-700 dark:bg-blue-900 dark:text-blue-300 border border-blue-200 dark:border-blue-700">
                {dict.hero.openSourceBadge}
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-4">
              <CTAButton variant="primary" size="lg">
                {dict.hero.scheduleDemoCTA}
              </CTAButton>
              
              <button
                onClick={scrollToArchitecture}
                className="text-blue-500 hover:text-blue-600 font-semibold underline underline-offset-4 hover:underline-offset-8 transition-all duration-300"
              >
                {dict.hero.architectureGuide}
              </button>
            </div>
          </motion.div>

          {/* Right Column - Animated SVG */}
          <motion.div
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="flex justify-center lg:justify-end"
          >
            <div className="relative w-full max-w-md">
              <Image
                src="/hero-pipeline.svg"
                alt="Real-time data pipeline visualization"
                width={400}
                height={300}
                className="w-full h-auto"
                priority
              />
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
} 