"use client";

import { memo, useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

interface SpotlightBackdropProps {
  onClose: () => void;
  children: ReactNode;
}

export const SpotlightBackdrop = memo(function SpotlightBackdrop({
  onClose,
  children,
}: Readonly<SpotlightBackdropProps>) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  if (!mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] bg-black/40 backdrop-blur-sm"
      onClick={onClose}
      aria-hidden="true"
    >
      {children}
    </div>,
    document.body,
  );
});
