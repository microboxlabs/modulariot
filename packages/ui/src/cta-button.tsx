'use client';

import React from 'react';
import { Button } from 'flowbite-react';

export interface CTAButtonProps extends React.ComponentProps<typeof Button> {
  as?: 'button' | 'a' | React.ElementType;
  modalContent?: {
    title: string;
    content: React.ReactNode;
    size?: string;
  };
}

export const CTAButton = React.forwardRef<any, CTAButtonProps>(
  ({ as = 'button', modalContent, ...props }, ref) => {
    // Only support modalContent for button
    if (modalContent && as !== 'button') {
      // eslint-disable-next-line no-console
      console.warn('modalContent is only supported for as="button"');
    }
    return (
      <Button
        ref={ref}
        as={as}
        {...props}
      />
    );
  }
);

CTAButton.displayName = 'CTAButton';

/**
 * Usage for Next.js:
 * <Link href="/org/new" passHref legacyBehavior>
 *   <CTAButton as="a">New organization</CTAButton>
 * </Link>
 * or
 * <CTAButton href="/org/new" as="a">New organization</CTAButton>
 */ 