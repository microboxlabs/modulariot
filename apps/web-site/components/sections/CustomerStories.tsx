'use client';

import { useState } from 'react';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { IoChevronBack, IoChevronForward, IoChatbubbleEllipses } from 'react-icons/io5';

const stories = [
  {
    id: 1,
    company: 'Mintral Systems',
    logo: '/mintral-logo.svg',
    quote: 'Modular IoT reduced our deployment time by 80% and gave us unprecedented visibility into our fleet operations.',
    author: 'Sarah Chen',
    role: 'CTO, Mintral Systems',
    industry: 'Manufacturing',
    link: '#case-study-mintral',
  },
  {
    id: 2,
    company: 'TechFlow Industries',
    logo: '/logo.svg',
    quote: 'The open-source architecture means we\'re never locked in. We can adapt and scale exactly as we need.',
    author: 'Marcus Rodriguez',
    role: 'Head of Engineering',
    industry: 'Logistics',
    link: '#case-study-techflow',
  },
  {
    id: 3,
    company: 'EcoSensor Networks',
    logo: '/logo.svg',
    quote: 'Real-time symptom detection caught critical issues before they became costly failures. ROI was immediate.',
    author: 'Dr. Emily Watson',
    role: 'VP of Operations',
    industry: 'Environmental',
    link: '#case-study-ecosensor',
  },
];

export default function CustomerStories() {
  const [currentStory, setCurrentStory] = useState(0);

  const nextStory = () => {
    setCurrentStory((prev) => (prev + 1) % stories.length);
  };

  const prevStory = () => {
    setCurrentStory((prev) => (prev - 1 + stories.length) % stories.length);
  };

  return (
    <section id="customers" className="bg-gray-50 dark:bg-gray-800 py-16 sm:py-20">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
          className="mx-auto max-w-2xl text-center mb-12"
        >
          <h2 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-4xl">
            Trusted by industry leaders
          </h2>
          <p className="mt-4 text-lg leading-8 text-gray-600 dark:text-gray-300">
            See how companies are transforming their IoT operations with Modular IoT
          </p>
        </motion.div>

        <div className="relative">
          <div className="overflow-hidden">
            <div 
              className="flex transition-transform duration-500 ease-in-out"
              style={{ transform: `translateX(-${currentStory * 100}%)` }}
            >
              {stories.map((story) => (
                <div key={story.id} className="w-full flex-shrink-0">
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    whileInView={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.6 }}
                    viewport={{ once: true }}
                    className="mx-auto max-w-4xl"
                  >
                    <div className="bg-white dark:bg-gray-900 rounded-2xl p-8 lg:p-12 shadow-lg">
                      <div className="flex items-center justify-center mb-8">
                        <Image
                          src={story.logo}
                          alt={story.company}
                          width={120}
                          height={40}
                          className="h-10 w-auto grayscale"
                          loading="lazy"
                        />
                      </div>
                      
                      <blockquote className="text-center">
                        <IoChatbubbleEllipses className="h-8 w-8 text-blue-600 dark:text-blue-400 mx-auto mb-6" />
                        <p className="text-xl lg:text-2xl font-medium text-gray-900 dark:text-white leading-relaxed mb-8">
                          &ldquo;{story.quote}&rdquo;
                        </p>
                        <footer>
                          <div className="flex flex-col items-center">
                            <p className="font-semibold text-gray-900 dark:text-white">
                              {story.author}
                            </p>
                            <p className="text-gray-600 dark:text-gray-300">
                              {story.role}
                            </p>
                            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300 mt-2">
                              {story.industry}
                            </span>
                          </div>
                        </footer>
                      </blockquote>
                      
                      <div className="text-center mt-8">
                        <a
                          href={story.link}
                          className="inline-flex items-center text-blue-600 dark:text-blue-400 font-medium hover:text-blue-500 transition-colors"
                        >
                          Read full case study
                          <svg className="ml-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </a>
                      </div>
                    </div>
                  </motion.div>
                </div>
              ))}
            </div>
          </div>

          {/* Navigation */}
          <div className="flex justify-center items-center mt-8 space-x-4">
            <button
              onClick={prevStory}
              className="p-2 rounded-full bg-white dark:bg-gray-700 shadow-md hover:shadow-lg transition-shadow"
              aria-label="Previous story"
            >
              <IoChevronBack className="h-5 w-5 text-gray-600 dark:text-gray-300" />
            </button>
            
            <div className="flex space-x-2">
              {stories.map((_, index) => (
                <button
                  key={index}
                  onClick={() => setCurrentStory(index)}
                  className={`w-3 h-3 rounded-full transition-colors ${
                    index === currentStory
                      ? 'bg-blue-600 dark:bg-blue-400'
                      : 'bg-gray-300 dark:bg-gray-600'
                  }`}
                  aria-label={`Go to story ${index + 1}`}
                />
              ))}
            </div>
            
            <button
              onClick={nextStory}
              className="p-2 rounded-full bg-white dark:bg-gray-700 shadow-md hover:shadow-lg transition-shadow"
              aria-label="Next story"
            >
              <IoChevronForward className="h-5 w-5 text-gray-600 dark:text-gray-300" />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
} 