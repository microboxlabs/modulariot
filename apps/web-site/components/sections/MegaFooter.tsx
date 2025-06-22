'use client';

import Link from 'next/link';
import Image from 'next/image';
import { IoLogoGithub, IoLogoTwitter, IoLogoLinkedin, IoMail } from 'react-icons/io5';

const footerSections = {
  product: {
    title: 'Product',
    links: [
      { name: 'Features', href: '#features' },
      { name: 'Pricing', href: '#pricing' },
      { name: 'Security', href: '#security' },
      { name: 'Enterprise', href: '#enterprise' },
      { name: 'Changelog', href: '#changelog' },
      { name: 'Status', href: 'https://status.modulariot.com' },
    ],
  },
  developers: {
    title: 'Developers',
    links: [
      { name: 'Documentation', href: '#docs' },
      { name: 'API Reference', href: '#api' },
      { name: 'Quick Start', href: '#quickstart' },
      { name: 'Examples', href: '#examples' },
      { name: 'SDKs', href: '#sdks' },
      { name: 'Contribute', href: 'https://github.com/modulariot/modulariot' },
    ],
  },
  company: {
    title: 'Company',
    links: [
      { name: 'About', href: '#about' },
      { name: 'Blog', href: '#blog' },
      { name: 'Careers', href: '#careers' },
      { name: 'Press', href: '#press' },
      { name: 'Partners', href: '#partners' },
      { name: 'Contact', href: '#contact' },
    ],
  },
  resources: {
    title: 'Resources',
    links: [
      { name: 'Community', href: '#community' },
      { name: 'Support', href: '#support' },
      { name: 'Case Studies', href: '#case-studies' },
      { name: 'Webinars', href: '#webinars' },
      { name: 'White Papers', href: '#whitepapers' },
      { name: 'Help Center', href: '#help' },
    ],
  },
};

const socialLinks = [
  { name: 'GitHub', href: 'https://github.com/modulariot', icon: IoLogoGithub },
  { name: 'Twitter', href: 'https://twitter.com/modulariot', icon: IoLogoTwitter },
  { name: 'LinkedIn', href: 'https://linkedin.com/company/modulariot', icon: IoLogoLinkedin },
  { name: 'Email', href: 'mailto:hello@modulariot.com', icon: IoMail },
];

export default function MegaFooter() {
  return (
    <footer className="bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800">
      <div className="mx-auto max-w-7xl px-6 lg:px-8 py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-8">
          {/* Brand Column */}
          <div className="lg:col-span-2">
            <Link href="/" className="flex items-center space-x-2">
              <Image
                src="/logo.svg"
                alt="Modular IoT"
                width={32}
                height={32}
                className="h-8 w-8"
              />
              <span className="text-xl font-bold text-gray-900 dark:text-white">
                Modular IoT
              </span>
            </Link>
            <p className="mt-4 text-sm text-gray-600 dark:text-gray-300 max-w-md">
              Open-source IoT monitoring platform that helps you detect issues before they become problems. 
              Built for developers, by developers.
            </p>
            <div className="mt-6 flex space-x-4">
              {socialLinks.map((social) => (
                <a
                  key={social.name}
                  href={social.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300 transition-colors"
                >
                  <span className="sr-only">{social.name}</span>
                  <social.icon className="h-6 w-6" />
                </a>
              ))}
            </div>
          </div>

          {/* Product Column */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wider">
              {footerSections.product.title}
            </h3>
            <ul className="mt-4 space-y-3">
              {footerSections.product.links.map((link) => (
                <li key={link.name}>
                  <a
                    href={link.href}
                    className="text-sm text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
                  >
                    {link.name}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Developers Column */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wider">
              {footerSections.developers.title}
            </h3>
            <ul className="mt-4 space-y-3">
              {footerSections.developers.links.map((link) => (
                <li key={link.name}>
                  <a
                    href={link.href}
                    className="text-sm text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
                  >
                    {link.name}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Company Column */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wider">
              {footerSections.company.title}
            </h3>
            <ul className="mt-4 space-y-3">
              {footerSections.company.links.map((link) => (
                <li key={link.name}>
                  <a
                    href={link.href}
                    className="text-sm text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
                  >
                    {link.name}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Resources Column */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wider">
              {footerSections.resources.title}
            </h3>
            <ul className="mt-4 space-y-3">
              {footerSections.resources.links.map((link) => (
                <li key={link.name}>
                  <a
                    href={link.href}
                    className="text-sm text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
                  >
                    {link.name}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="mt-12 pt-8 border-t border-gray-200 dark:border-gray-700">
          <div className="flex flex-col md:flex-row items-center justify-between">
            <div className="flex items-center space-x-6">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                © 2025 MicroboxLabs. All rights reserved.
              </p>
              <div className="flex items-center space-x-4">
                <a
                  href="#privacy"
                  className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
                >
                  Privacy
                </a>
                <a
                  href="#terms"
                  className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
                >
                  Terms
                </a>
                <a
                  href="#cookies"
                  className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
                >
                  Cookies
                </a>
              </div>
            </div>
            <div className="mt-4 md:mt-0">
              <div className="flex items-center space-x-2 text-sm text-gray-500 dark:text-gray-400">
                <span>Made with</span>
                <span className="text-red-500">♥</span>
                <span>for the IoT community</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
} 