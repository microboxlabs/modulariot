'use client';

import { motion } from 'framer-motion';
import { HiMail, HiPhone, HiLocationMarker } from 'react-icons/hi';
import { FaLinkedin, FaTwitter, FaGithub } from 'react-icons/fa';
import Link from 'next/link';
import { Logo } from '@modulariot/ui/Logo';

export default function FooterSection() {
  return (
    <footer className="bg-gray-900 text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="grid md:grid-cols-4 gap-8 mb-12">
          {/* Company Info */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
          >
            <div className="flex items-center mb-4">
              <Logo size="xs" src="/logo.svg" />
              <span className="text-xl font-bold">Modular IoT</span>
            </div>
            <p className="text-gray-300 mb-4 leading-relaxed">
              Real-time fleet data streaming platform. Own your data, control your destiny.
            </p>
            <div className="flex space-x-4">
              <Link href="https://linkedin.com/company/microboxlabs" className="text-gray-400 hover:text-white transition-colors">
                <FaLinkedin className="h-5 w-5" />
              </Link>
              <Link href="https://twitter.com/microboxlabs" className="text-gray-400 hover:text-white transition-colors">
                <FaTwitter className="h-5 w-5" />
              </Link>
              <Link href="https://github.com/microboxlabs" className="text-gray-400 hover:text-white transition-colors">
                <FaGithub className="h-5 w-5" />
              </Link>
            </div>
          </motion.div>

          {/* Documentation */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            viewport={{ once: true }}
          >
            <h4 className="font-semibold mb-4">Documentation</h4>
            <ul className="space-y-2 text-gray-300">
              <li><Link href="/docs/quickstart" className="hover:text-white transition-colors">Quick Start</Link></li>
              <li><Link href="/docs/api" className="hover:text-white transition-colors">API Reference</Link></li>
              <li><Link href="/docs/integrations" className="hover:text-white transition-colors">Integrations</Link></li>
              <li><Link href="https://github.com/microboxlabs/modular-iot/blob/main/CONTRIBUTING.md" className="hover:text-white transition-colors">Contribute</Link></li>
              <li><Link href="https://github.com/microboxlabs/modular-iot" className="hover:text-white transition-colors">GitHub</Link></li>
            </ul>
          </motion.div>

          {/* Resources */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            viewport={{ once: true }}
          >
            <h4 className="font-semibold mb-4">Resources</h4>
            <ul className="space-y-2 text-gray-300">
              <li><Link href="/blog" className="hover:text-white transition-colors">Blog</Link></li>
              <li><Link href="/case-studies" className="hover:text-white transition-colors">Case Studies</Link></li>
              <li><Link href="/webinars" className="hover:text-white transition-colors">Webinars</Link></li>
              <li><Link href="/about" className="hover:text-white transition-colors">About MicroboxLabs</Link></li>
            </ul>
          </motion.div>

          {/* Contact */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            viewport={{ once: true }}
          >
            <h4 className="font-semibold mb-4">Contact</h4>
            <div className="space-y-3 text-gray-300">
              <div className="flex items-center">
                <HiMail className="h-4 w-4 mr-3" />
                <Link href="mailto:hello@microboxlabs.com" className="hover:text-white transition-colors">
                  hello@microboxlabs.com
                </Link>
              </div>
              <div className="flex items-center">
                <HiPhone className="h-4 w-4 mr-3" />
                <span>+1 (555) 123-4567</span>
              </div>
              <div className="flex items-center">
                <HiLocationMarker className="h-4 w-4 mr-3" />
                <span>San Francisco, CA</span>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Contact Form */}
        <motion.div
          id="cta-form"
          initial={{ opacity: 0, y: 50 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.4 }}
          viewport={{ once: true }}
          className="bg-gray-800 rounded-2xl p-8 mb-12"
        >
          <div className="max-w-2xl mx-auto text-center">
            <h3 className="text-2xl font-bold mb-4">Get Started Today</h3>
            <p className="text-gray-300 mb-8">
              Ready to see your fleet data flowing in real-time? Let&apos;s set up a demo.
            </p>
            <form className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <input
                  type="text"
                  placeholder="Your name"
                  className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                  required
                />
                <input
                  type="email"
                  placeholder="Work email"
                  className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                  required
                />
              </div>
              <input
                type="text"
                placeholder="Company name"
                className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                required
              />
              <textarea
                placeholder="Tell us about your fleet and use case&hellip;"
                rows={4}
                className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none resize-none"
                required
              />
              <button
                type="submit"
                className="w-full bg-blue-500 hover:bg-blue-600 text-white font-semibold py-3 px-6 rounded-lg transition-colors duration-200"
              >
                Request Demo
              </button>
            </form>
          </div>
        </motion.div>

        {/* Copyright */}
        <div className="border-t border-gray-700 pt-8">
          <div className="flex flex-col md:flex-row justify-between items-center text-gray-400">
            <p>&copy; 2024 MicroboxLabs. All rights reserved.</p>
            <div className="flex space-x-6 mt-4 md:mt-0">
              <Link href="/privacy" className="hover:text-white transition-colors">Privacy Policy</Link>
              <Link href="/terms" className="hover:text-white transition-colors">Terms of Service</Link>
              <Link href="/security" className="hover:text-white transition-colors">Security</Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
} 