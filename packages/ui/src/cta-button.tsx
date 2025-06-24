'use client';

import React, { forwardRef } from 'react';
import { Button, Modal } from 'flowbite-react';

interface CTAButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  /** Optional modal content - if provided, button will open modal */
  modalContent?: {
    title: string;
    content: React.ReactNode;
    size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | '5xl' | '6xl' | '7xl';
  };
  /** Optional click handler - if provided, modal will not be used */
  onClick?: () => void;
  /** Optional href for link behavior */
  href?: string;
  /** Disabled state */
  disabled?: boolean;
}

export const CTAButton = forwardRef<HTMLButtonElement, CTAButtonProps>(
  (
    {
      children,
      variant = 'primary',
      size = 'lg',
      className = '',
      modalContent,
      onClick,
      href,
      disabled = false,
      type = 'button',
      ...rest
    },
    ref
  ) => {
    const [openModal, setOpenModal] = React.useState(false);

    const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
      if (onClick) {
        onClick();
        e.preventDefault();
      } else if (modalContent) {
        setOpenModal(true);
        e.preventDefault();
      } else if (href) {
        window.open(href, '_blank');
        e.preventDefault();
      }
      // Otherwise, let the button behave as normal (e.g., submit)
    };

    const buttonClasses = `${className} ${
      variant === 'primary'
        ? 'bg-blue-500 hover:bg-blue-600 focus:ring-blue-300 text-white'
        : 'text-blue-500 hover:text-blue-600 border-blue-500 hover:bg-blue-50'
    }`;

    return (
      <>
        <Button
          ref={ref}
          color={variant === 'primary' ? 'blue' : 'light'}
          size={size}
          onClick={handleClick}
          disabled={disabled}
          className={buttonClasses}
          type={type}
          {...rest}
        >
          {children}
        </Button>

        {modalContent && (
          <Modal
            show={openModal}
            onClose={() => setOpenModal(false)}
            size={modalContent.size || '4xl'}
          >
            <div className="p-6">
              <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-600 pb-4 mb-4">
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                  {modalContent.title}
                </h3>
                <button
                  onClick={() => setOpenModal(false)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-xl leading-none"
                  aria-label="Close modal"
                >
                  ✕
                </button>
              </div>
              <div className="min-h-[400px]">
                {modalContent.content}
              </div>
            </div>
          </Modal>
        )}
      </>
    );
  }
);

CTAButton.displayName = 'CTAButton'; 