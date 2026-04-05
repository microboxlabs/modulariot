"use client";

import { Suspense, type PropsWithChildren } from "react";
import { useKioskMode } from "../hooks/use-kiosk-mode";

function KioskShellInner({ children }: Readonly<PropsWithChildren>) {
  const isKiosk = useKioskMode();

  if (!isKiosk) return <>{children}</>;

  return (
    <div data-kiosk="true" className="flex h-screen flex-col">
      <style jsx global>{`
        [data-kiosk] nav {
          display: none !important;
        }
        [data-kiosk] [data-testid="content-with-sidebar"] {
          margin-top: 0 !important;
          margin-bottom: 0 !important;
        }
        [data-kiosk] [data-testid="content-with-sidebar"] aside {
          display: none !important;
        }
        [data-kiosk] footer {
          display: none !important;
        }
      `}</style>
      {children}
    </div>
  );
}

export function KioskShell({ children }: Readonly<PropsWithChildren>) {
  return (
    <Suspense fallback={<>{children}</>}>
      <KioskShellInner>{children}</KioskShellInner>
    </Suspense>
  );
}
