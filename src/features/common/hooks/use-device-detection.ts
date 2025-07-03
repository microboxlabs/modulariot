import { useEffect, useState } from "react";

export type DeviceType = "mobile" | "tablet" | "desktop" | "unknown";

export type OperatingSystem =
  | "Windows"
  | "macOS"
  | "Linux"
  | "iOS"
  | "Android"
  | "ChromeOS"
  | "unknown";

interface DeviceInfo {
  type: DeviceType;
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  userAgent: string;
  screenWidth: number;
  screenHeight: number;
  orientation: "portrait" | "landscape";
  operatingSystem: OperatingSystem;
  osVersion?: string;
}

export function useDeviceDetection(): DeviceInfo {
  const [deviceInfo, setDeviceInfo] = useState<DeviceInfo>({
    type: "unknown",
    isMobile: false,
    isTablet: false,
    isDesktop: false,
    userAgent: "",
    screenWidth: 0,
    screenHeight: 0,
    orientation: "portrait",
    operatingSystem: "unknown",
    osVersion: undefined,
  });

  useEffect(() => {
    if (typeof window === "undefined") return;

    const detectOperatingSystem = (
      userAgent: string,
    ): { os: OperatingSystem; version?: string } => {
      // iOS detection
      if (/iPad|iPhone|iPod/.test(userAgent)) {
        const match = userAgent.match(/OS (\d+_\d+)/);
        const version = match ? match[1].replace("_", ".") : undefined;
        return { os: "iOS", version };
      }

      // Android detection
      if (/Android/.test(userAgent)) {
        const match = userAgent.match(/Android (\d+\.\d+)/);
        const version = match ? match[1] : undefined;
        return { os: "Android", version };
      }

      // Windows detection
      if (/Windows/.test(userAgent)) {
        const match = userAgent.match(/Windows NT (\d+\.\d+)/);
        const version = match ? match[1] : undefined;
        return { os: "Windows", version };
      }

      // macOS detection
      if (/Mac OS X/.test(userAgent)) {
        const match = userAgent.match(/Mac OS X (\d+[._]\d+)/);
        const version = match ? match[1].replace("_", ".") : undefined;
        return { os: "macOS", version };
      }

      // Linux detection
      if (/Linux/.test(userAgent)) {
        return { os: "Linux" };
      }

      // ChromeOS detection
      if (/CrOS/.test(userAgent)) {
        const match = userAgent.match(/CrOS (\d+\.\d+)/);
        const version = match ? match[1] : undefined;
        return { os: "ChromeOS", version };
      }

      return { os: "unknown" };
    };

    const detectDevice = (): DeviceInfo => {
      const userAgent = navigator.userAgent;
      const screenWidth = window.screen.width;
      const screenHeight = window.screen.height;
      const orientation = screenWidth > screenHeight ? "landscape" : "portrait";

      // Detect operating system
      const { os: operatingSystem, version: osVersion } =
        detectOperatingSystem(userAgent);

      // Method 1: User Agent Detection
      const isMobileUA =
        /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
          userAgent,
        );
      const isTabletUA = /iPad|Android(?=.*\bMobile\b)(?=.*\bSafari\b)/i.test(
        userAgent,
      );

      // Method 2: Screen Size Detection
      const isMobileScreen = screenWidth <= 768;
      const isTabletScreen = screenWidth > 768 && screenWidth <= 1024;
      const isDesktopScreen = screenWidth > 1024;

      // Method 3: Touch Capability Detection
      const hasTouchScreen =
        "ontouchstart" in window || navigator.maxTouchPoints > 0;

      // Method 4: Pointer Detection
      const hasCoarsePointer = window.matchMedia("(pointer: coarse)").matches;
      const hasFinePointer = window.matchMedia("(pointer: fine)").matches;

      // Method 5: Hover Capability Detection
      const hasHover = window.matchMedia("(hover: hover)").matches;

      // Combined detection logic
      let type: DeviceType = "unknown";
      let isMobile = false;
      let isTablet = false;
      let isDesktop = false;

      // Primary detection based on user agent and screen size
      if (isMobileUA || (isMobileScreen && hasTouchScreen)) {
        type = "mobile";
        isMobile = true;
      } else if (isTabletUA || (isTabletScreen && hasTouchScreen)) {
        type = "tablet";
        isTablet = true;
      } else if (isDesktopScreen || (!hasTouchScreen && hasFinePointer)) {
        type = "desktop";
        isDesktop = true;
      } else {
        // Fallback detection
        if (hasCoarsePointer && hasTouchScreen) {
          type = "mobile";
          isMobile = true;
        } else if (hasFinePointer && hasHover) {
          type = "desktop";
          isDesktop = true;
        } else {
          // Default based on screen size
          if (screenWidth <= 768) {
            type = "mobile";
            isMobile = true;
          } else if (screenWidth <= 1024) {
            type = "tablet";
            isTablet = true;
          } else {
            type = "desktop";
            isDesktop = true;
          }
        }
      }

      return {
        type,
        isMobile,
        isTablet,
        isDesktop,
        userAgent,
        screenWidth,
        screenHeight,
        orientation,
        operatingSystem,
        osVersion,
      };
    };

    const updateDeviceInfo = () => {
      setDeviceInfo(detectDevice());
    };

    // Initial detection
    updateDeviceInfo();

    // Listen for orientation changes
    const handleOrientationChange = () => {
      setTimeout(updateDeviceInfo, 100); // Small delay to ensure screen dimensions are updated
    };

    // Listen for resize events
    const handleResize = () => {
      updateDeviceInfo();
    };

    window.addEventListener("orientationchange", handleOrientationChange);
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("orientationchange", handleOrientationChange);
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  return deviceInfo;
}

// Utility functions for specific device checks
export const isMobileDevice = (): boolean => {
  if (typeof window === "undefined") return false;

  const userAgent = navigator.userAgent;
  const hasTouchScreen =
    "ontouchstart" in window || navigator.maxTouchPoints > 0;
  const hasCoarsePointer = window.matchMedia("(pointer: coarse)").matches;

  return (
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
      userAgent,
    ) ||
    (hasTouchScreen && hasCoarsePointer)
  );
};

export const isTabletDevice = (): boolean => {
  if (typeof window === "undefined") return false;

  const userAgent = navigator.userAgent;
  const screenWidth = window.screen.width;

  return (
    /iPad|Android(?=.*\bMobile\b)(?=.*\bSafari\b)/i.test(userAgent) ||
    (screenWidth > 768 && screenWidth <= 1024)
  );
};

export const isDesktopDevice = (): boolean => {
  if (typeof window === "undefined") return false;

  const hasTouchScreen =
    "ontouchstart" in window || navigator.maxTouchPoints > 0;
  const hasFinePointer = window.matchMedia("(pointer: fine)").matches;
  const hasHover = window.matchMedia("(hover: hover)").matches;

  return hasFinePointer && hasHover && !hasTouchScreen;
};

// Utility functions for operating system detection
export const getOperatingSystem = (): OperatingSystem => {
  if (typeof window === "undefined") return "unknown";

  const userAgent = navigator.userAgent;

  if (/iPad|iPhone|iPod/.test(userAgent)) return "iOS";
  if (/Android/.test(userAgent)) return "Android";
  if (/Windows/.test(userAgent)) return "Windows";
  if (/Mac OS X/.test(userAgent)) return "macOS";
  if (/Linux/.test(userAgent)) return "Linux";
  if (/CrOS/.test(userAgent)) return "ChromeOS";

  return "unknown";
};

export const getOSVersion = (): string | undefined => {
  if (typeof window === "undefined") return undefined;

  const userAgent = navigator.userAgent;

  // iOS version
  const iosMatch = userAgent.match(/OS (\d+_\d+)/);
  if (iosMatch) return iosMatch[1].replace("_", ".");

  // Android version
  const androidMatch = userAgent.match(/Android (\d+\.\d+)/);
  if (androidMatch) return androidMatch[1];

  // Windows version
  const windowsMatch = userAgent.match(/Windows NT (\d+\.\d+)/);
  if (windowsMatch) return windowsMatch[1];

  // macOS version
  const macMatch = userAgent.match(/Mac OS X (\d+[._]\d+)/);
  if (macMatch) return macMatch[1].replace("_", ".");

  // ChromeOS version
  const chromeMatch = userAgent.match(/CrOS (\d+\.\d+)/);
  if (chromeMatch) return chromeMatch[1];

  return undefined;
};

// Convenience functions for specific OS checks
export const isIOS = (): boolean => getOperatingSystem() === "iOS";
export const isAndroid = (): boolean => getOperatingSystem() === "Android";
export const isWindows = (): boolean => getOperatingSystem() === "Windows";
export const isMacOS = (): boolean => getOperatingSystem() === "macOS";
export const isLinux = (): boolean => getOperatingSystem() === "Linux";
export const isChromeOS = (): boolean => getOperatingSystem() === "ChromeOS";
