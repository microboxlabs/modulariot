'use client';

import Image from 'next/image';
import { motion } from 'framer-motion';
import { IoLogoTwitter, IoLogoLinkedin, IoHeart, IoRepeat } from 'react-icons/io5';

const tweets = [
  {
    id: 1,
    platform: 'twitter',
    author: 'Sarah Chen',
    handle: '@sarah_iot_dev',
    avatar: '/logo.svg',
    content: 'Just deployed @ModularIoT in our factory. Setup took 10 minutes and we\'re already catching issues we missed before. The developer experience is incredible! 🚀',
    likes: 234,
    retweets: 67,
    timestamp: '2h',
  },
  {
    id: 2,
    platform: 'linkedin',
    author: 'Marcus Rodriguez',
    handle: 'Head of Engineering at TechFlow',
    avatar: '/logo.svg',
    content: 'After evaluating 12 IoT platforms, Modular IoT stood out for its open architecture and zero vendor lock-in. Our team was productive from day one.',
    likes: 156,
    retweets: 43,
    timestamp: '4h',
  },
  {
    id: 3,
    platform: 'twitter',
    author: 'Dr. Emily Watson',
    handle: '@emily_ecosensor',
    avatar: '/logo.svg',
    content: 'The real-time symptom detection in @ModularIoT saved us from a $50k equipment failure. The ROI was immediate. Can\'t recommend enough! 💯',
    likes: 189,
    retweets: 92,
    timestamp: '1d',
  },
  {
    id: 4,
    platform: 'linkedin',
    author: 'Alex Kim',
    handle: 'IoT Architect at DataFlow Industries',
    avatar: '/logo.svg',
    content: 'Finally, an IoT platform that doesn\'t fight you. Modular IoT\'s API design is clean, docs are excellent, and the community is super helpful.',
    likes: 278,
    retweets: 81,
    timestamp: '2d',
  },
];

export default function CommunityTweets() {
  return (
    <section id="community" className="bg-white dark:bg-gray-900 py-16 sm:py-20">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
          className="mx-auto max-w-2xl text-center mb-12"
        >
          <h2 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-4xl">
            Loved by developers worldwide
          </h2>
          <p className="mt-4 text-lg leading-8 text-gray-600 dark:text-gray-300">
            See what the community is saying about their Modular IoT experience
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {tweets.map((tweet, index) => (
            <motion.div
              key={tweet.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: index * 0.1 }}
              viewport={{ once: true }}
              className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm hover:shadow-lg transition-all duration-300 border border-gray-200 dark:border-gray-700"
            >
              <div className="flex items-start space-x-3">
                <Image
                  src={tweet.avatar}
                  alt={tweet.author}
                  width={48}
                  height={48}
                  className="w-12 h-12 rounded-full"
                  loading="lazy"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <h4 className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                        {tweet.author}
                      </h4>
                      <div className="flex-shrink-0">
                        {tweet.platform === 'twitter' ? (
                          <IoLogoTwitter className="w-4 h-4 text-blue-400" />
                        ) : (
                          <IoLogoLinkedin className="w-4 h-4 text-blue-600" />
                        )}
                      </div>
                    </div>
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {tweet.timestamp}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                    {tweet.handle}
                  </p>
                  <p className="text-sm text-gray-900 dark:text-white leading-relaxed mb-4">
                    {tweet.content}
                  </p>
                  <div className="flex items-center space-x-6 text-gray-500 dark:text-gray-400">
                    <div className="flex items-center space-x-2">
                      <IoHeart className="w-4 h-4" />
                      <span className="text-xs">{tweet.likes}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <IoRepeat className="w-4 h-4" />
                      <span className="text-xs">{tweet.retweets}</span>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          viewport={{ once: true }}
          className="text-center mt-12"
        >
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Join the conversation on{' '}
            <a 
              href="https://twitter.com/modulariot" 
              className="font-medium text-blue-600 dark:text-blue-400 hover:text-blue-500"
              target="_blank"
              rel="noopener noreferrer"
            >
              Twitter
            </a>
            {' '}and{' '}
            <a 
              href="https://linkedin.com/company/modulariot" 
              className="font-medium text-blue-600 dark:text-blue-400 hover:text-blue-500"
              target="_blank"
              rel="noopener noreferrer"
            >
              LinkedIn
            </a>
          </p>
        </motion.div>
      </div>
    </section>
  );
} 