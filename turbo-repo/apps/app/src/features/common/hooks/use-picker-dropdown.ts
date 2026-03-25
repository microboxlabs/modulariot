"use client";

import { useEffect, useRef, useState, useCallback } from "react";

interface PickerDropdownState {
  /** Whether the dropdown is currently open */
  isOpen: boolean;
  /** Position for rendering the portal dropdown */
  position: { top: number; left: number } | null;
}

interface UsePickerDropdownOptions {
  /** Data attribute name for the portal to detect click outside (e.g., "data-colorpicker-portal") */
  portalDataAttribute: string;
  /** Width of the dropdown for positioning (default: 120px) */
  dropdownWidth?: number;
}

interface UsePickerDropdownReturn<T extends HTMLElement = HTMLButtonElement> {
  /** Whether dropdown is open */
  isOpen: boolean;
  /** Dropdown position for portal */
  position: { top: number; left: number } | null;
  /** Ref to attach to trigger element */
  triggerRef: React.RefObject<T | null>;
  /** Toggle or open the dropdown */
  toggle: () => void;
  /** Close the dropdown */
  close: () => void;
  /** Data attribute string for the portal element */
  portalDataAttribute: string;
}

/**
 * Shared hook for picker dropdowns (color picker, icon picker, etc.)
 * Handles position calculation, click outside, and escape key handling.
 */
export function usePickerDropdown<T extends HTMLElement = HTMLButtonElement>({
  portalDataAttribute,
  dropdownWidth = 120,
}: UsePickerDropdownOptions): UsePickerDropdownReturn<T> {
  const [state, setState] = useState<PickerDropdownState>({
    isOpen: false,
    position: null,
  });
  const triggerRef = useRef<T>(null);

  // Calculate position and open
  const handleOpen = useCallback(() => {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setState({
        isOpen: true,
        position: {
          top: rect.bottom + window.scrollY + 4,
          left: rect.right + window.scrollX - dropdownWidth,
        },
      });
    }
  }, [dropdownWidth]);

  const close = useCallback(() => {
    setState({ isOpen: false, position: null });
  }, []);

  const toggle = useCallback(() => {
    if (state.isOpen) {
      close();
    } else {
      handleOpen();
    }
  }, [state.isOpen, close, handleOpen]);

  // Reset position when closed
  useEffect(() => {
    if (!state.isOpen) {
      setState((prev) => (prev.position ? { ...prev, position: null } : prev));
    }
  }, [state.isOpen]);

  // Click outside and escape key handling
  useEffect(() => {
    if (!state.isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (
        !target.closest(`[${portalDataAttribute}]`) &&
        !triggerRef.current?.contains(target)
      ) {
        close();
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [state.isOpen, portalDataAttribute, close]);

  return {
    isOpen: state.isOpen,
    position: state.position,
    triggerRef,
    toggle,
    close,
    portalDataAttribute,
  };
}
