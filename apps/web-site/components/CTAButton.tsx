'use client';

import { Button, Modal } from 'flowbite-react';
import { useState } from 'react';

interface CTAButtonProps {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export default function CTAButton({ 
  children, 
  variant = 'primary', 
  size = 'lg',
  className = '' 
}: CTAButtonProps) {
  const [openModal, setOpenModal] = useState(false);
  
  const calendlyUrl = process.env.NEXT_PUBLIC_CALENDLY_URL || 
    'https://calendly.com/your-calendly-link';

  return (
    <>
      <Button
        color={variant === 'primary' ? 'blue' : 'light'}
        size={size}
        onClick={() => setOpenModal(true)}
        className={`${className} ${
          variant === 'primary' 
            ? 'bg-blue-500 hover:bg-blue-600 text-white' 
            : 'text-blue-500 hover:text-blue-600'
        }`}
      >
        {children}
      </Button>

      <Modal
        show={openModal}
        onClose={() => setOpenModal(false)}
        size="4xl"
      >
        <div className="p-6">
          <div className="flex items-center justify-between border-b border-gray-200 pb-4 mb-4">
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
              Book Your Tech Demo
            </h3>
            <button
              onClick={() => setOpenModal(false)}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              ✕
            </button>
          </div>
          <div className="min-h-[600px]">
            <iframe
              src={calendlyUrl}
              width="100%"
              height="600"
              frameBorder="0"
              title="Schedule Meeting"
              className="rounded-lg"
            />
          </div>
        </div>
      </Modal>
    </>
  );
} 