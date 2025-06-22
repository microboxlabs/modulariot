'use client';

import { useState, useEffect } from 'react';
import { DarkThemeToggle } from 'flowbite-react';
import { HiMenu, HiX } from 'react-icons/hi';
import Link from 'next/link';
import CTAButton from './CTAButton';
import GitHubButton from './GitHubButton';
import Image from 'next/image';

interface HeaderProps {
  dict: {
    navigation: {
      features: string;
      customers: string;
      quickStart: string;
      pricing: string;
      community: string;
      getDemo: string;
      starGitHub: string;
    };
  };
}

export default function Header({ dict }: HeaderProps) {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [promoHeight, setPromoHeight] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      const currentPromoHeight = parseInt(
        getComputedStyle(document.documentElement).getPropertyValue('--promo-height') || '0'
      );
      setPromoHeight(currentPromoHeight);
      setIsScrolled(window.scrollY > currentPromoHeight);
    };

    // Initial check
    handleScroll();
    
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToSection = (sectionId: string) => {
    const element = document.getElementById(sectionId);
    element?.scrollIntoView({ behavior: 'smooth' });
    setIsMobileMenuOpen(false);
  };

  return (
    <header
      className={`fixed left-0 right-0 z-50 transition-all duration-300 ${
        isScrolled
          ? 'bg-white/90 dark:bg-gray-900/90 backdrop-blur-md shadow-lg'
          : 'bg-transparent'
      }`}
      style={{ top: isScrolled ? '0' : `${promoHeight}px` }}
    >
      <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center space-x-3">
            <Image
              src="/headlogo.svg"
              alt="Modular IoT Logo"
              width={32}
              height={32}
              className="w-8 h-8"
            />
            <span className="text-xl font-bold text-gray-900 dark:text-white">
              Modular IoT
            </span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-8">
            <button
              onClick={() => scrollToSection('features')}
              className="text-gray-700 hover:text-blue-600 dark:text-gray-300 dark:hover:text-blue-400 font-medium transition-colors duration-200"
            >
              {dict.navigation.features}
            </button>
            <button
              onClick={() => scrollToSection('customers')}
              className="text-gray-700 hover:text-blue-600 dark:text-gray-300 dark:hover:text-blue-400 font-medium transition-colors duration-200"
            >
              {dict.navigation.customers}
            </button>
            <button
              onClick={() => scrollToSection('quick-start')}
              className="text-gray-700 hover:text-blue-600 dark:text-gray-300 dark:hover:text-blue-400 font-medium transition-colors duration-200"
            >
              {dict.navigation.quickStart}
            </button>
            <button
              onClick={() => scrollToSection('pricing')}
              className="text-gray-700 hover:text-blue-600 dark:text-gray-300 dark:hover:text-blue-400 font-medium transition-colors duration-200"
            >
              {dict.navigation.pricing}
            </button>
            <button
              onClick={() => scrollToSection('community')}
              className="text-gray-700 hover:text-blue-600 dark:text-gray-300 dark:hover:text-blue-400 font-medium transition-colors duration-200"
            >
              {dict.navigation.community}
            </button>
          </div>

          {/* Right side */}
          <div className="flex items-center space-x-4">
            <GitHubButton className="hidden md:inline-flex">
              {dict.navigation.starGitHub}
            </GitHubButton>
            <CTAButton variant="primary" size="sm" className="hidden sm:block">
              {dict.navigation.getDemo}
            </CTAButton>
            <DarkThemeToggle />
            
            {/* Mobile menu button */}
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="md:hidden p-2 rounded-md text-gray-700 hover:text-blue-600 dark:text-gray-300 dark:hover:text-blue-400"
            >
              {isMobileMenuOpen ? (
                <HiX className="h-6 w-6" />
              ) : (
                <HiMenu className="h-6 w-6" />
              )}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {isMobileMenuOpen && (
          <div className="md:hidden bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700">
            <div className="px-4 py-6 space-y-4">
              <button
                onClick={() => scrollToSection('features')}
                className="block w-full text-left text-gray-700 hover:text-blue-600 dark:text-gray-300 dark:hover:text-blue-400 font-medium"
              >
                {dict.navigation.features}
              </button>
              <button
                onClick={() => scrollToSection('customers')}
                className="block w-full text-left text-gray-700 hover:text-blue-600 dark:text-gray-300 dark:hover:text-blue-400 font-medium"
              >
                {dict.navigation.customers}
              </button>
              <button
                onClick={() => scrollToSection('quick-start')}
                className="block w-full text-left text-gray-700 hover:text-blue-600 dark:text-gray-300 dark:hover:text-blue-400 font-medium"
              >
                {dict.navigation.quickStart}
              </button>
              <button
                onClick={() => scrollToSection('pricing')}
                className="block w-full text-left text-gray-700 hover:text-blue-600 dark:text-gray-300 dark:hover:text-blue-400 font-medium"
              >
                {dict.navigation.pricing}
              </button>
              <button
                onClick={() => scrollToSection('community')}
                className="block w-full text-left text-gray-700 hover:text-blue-600 dark:text-gray-300 dark:hover:text-blue-400 font-medium"
              >
                {dict.navigation.community}
              </button>
              <div className="pt-4 border-t border-gray-200 dark:border-gray-700 space-y-4">
                <GitHubButton className="w-full">
                  {dict.navigation.starGitHub}
                </GitHubButton>
                <CTAButton variant="primary" size="sm" className="w-full">
                  {dict.navigation.getDemo}
                </CTAButton>
              </div>
            </div>
          </div>
        )}
      </nav>
    </header>
  );
} 