"use client";

import { useEffect, useRef, useState, useCallback } from "react";

interface PickerDropdownState {
  /** Whether the dropdown is currently open */
  isOpen: boolean;
  /** Position for rendering the portal dropdown */
  position: { top: number; left: number } | null;
  /** Whether dropdown opens above the trigger */
  opensUp: boolean;
}

interface UsePickerDropdownOptions {
  /** Data attribute name for the portal to detect click outside (e.g., "data-colorpicker-portal") */
  portalDataAttribute: string;
  /** Width of the dropdown for positioning (default: 120px) */
  dropdownWidth?: number;
  /** Height of the dropdown for auto top/bottom detection (default: 300px) */
  dropdownHeight?: number;
}

interface UsePickerDropdownReturn<T extends HTMLElement = HTMLButtonElement> {
  /** Whether dropdown is open */
  isOpen: boolean;
  /** Dropdown position for portal */
  position: { top: number; left: number } | null;
  /** Whether dropdown opens above the trigger */
  opensUp: boolean;
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
 * Automatically positions above or below based on available space.
 */
export function usePickerDropdown<T extends HTMLElement = HTMLButtonElement>({
  portalDataAttribute,
  dropdownWidth = 120,
  dropdownHeight = 300,
}: UsePickerDropdownOptions): UsePickerDropdownReturn<T> {
  const [state, setState] = useState<PickerDropdownState>({
    isOpen: false,
    position: null,
    opensUp: false,
  });
  const triggerRef = useRef<T>(null);

  // Calculate position and open
  const handleOpen = useCallback(() => {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const spaceBelow = viewportHeight - rect.bottom;
      const spaceAbove = rect.top;
      const gap = 4;

      // Prefer opening below, but open above if not enough space below
      const opensUp =
        spaceBelow < dropdownHeight + gap && spaceAbove > spaceBelow;

      const top = opensUp
        ? rect.top + window.scrollY - dropdownHeight - gap
        : rect.bottom + window.scrollY + gap;

      setState({
        isOpen: true,
        position: {
          top,
          left: rect.right + window.scrollX - dropdownWidth,
        },
        opensUp,
      });
    }
  }, [dropdownWidth, dropdownHeight]);

  const close = useCallback(() => {
    setState({ isOpen: false, position: null, opensUp: false });
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
    opensUp: state.opensUp,
    triggerRef,
    toggle,
    close,
    portalDataAttribute,
  };
}
