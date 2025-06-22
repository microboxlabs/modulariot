'use client';

import { useState, useEffect, useRef } from 'react';
import { IoClose } from 'react-icons/io5';

export default function PromoRibbon() {
  const [isVisible, setIsVisible] = useState(true);
  const ribbonRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (ribbonRef.current && isVisible) {
      const height = ribbonRef.current.offsetHeight;
      document.documentElement.style.setProperty('--promo-height', `${height}px`);
    } else {
      document.documentElement.style.setProperty('--promo-height', '0px');
    }
  }, [isVisible]);

  if (!isVisible) return null;

  return (
    <div ref={ribbonRef} className="relative bg-blue-600 dark:bg-blue-700 z-40">
      <div className="mx-auto max-w-7xl px-3 py-3 sm:px-6 lg:px-8">
        <div className="pr-16 sm:px-16 sm:text-center">
          <p className="font-medium text-white">
            <span className="md:hidden">
              We just launched Modular IoT v2.0!
            </span>
            <span className="hidden md:inline">
              🎉 We just launched Modular IoT v2.0 - Now with advanced symptom detection and edge computing!
            </span>
            <span className="block sm:ml-2 sm:inline-block">
              <a href="#hero" className="font-bold text-white underline">
                Learn more <span aria-hidden="true">&rarr;</span>
              </a>
            </span>
          </p>
        </div>
        <div className="absolute inset-y-0 right-0 flex items-start pt-1 pr-1 sm:items-start sm:pt-1 sm:pr-2">
          <button
            type="button"
            className="flex rounded-md p-2 hover:bg-blue-500 focus:outline-none focus:ring-2 focus:ring-white"
            onClick={() => setIsVisible(false)}
          >
            <span className="sr-only">Dismiss</span>
            <IoClose className="h-6 w-6 text-white" aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );
} 