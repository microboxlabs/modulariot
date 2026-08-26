"use client";

import { Suspense } from "react";
import HarnessChat from "@/features/harness-chat/harness-chat";
import { useHarnessSkills } from "@/features/harness-chat/hooks/use-harness-skills";
import { useKioskMode } from "@/features/layout/hooks/use-kiosk-mode";
import type { I18nDictionary } from "@/features/i18n/i18n.service.types";

type HarnessChatMountProps = Readonly<{ dict: I18nDictionary; locale: string }>;

function HarnessChatPanel({ dict, locale }: HarnessChatMountProps) {
  const skills = useHarnessSkills();
  return <HarnessChat skills={skills} dict={dict} locale={locale} />;
}

/**
 * This mount is a sibling of SecuredLayout (see layout.tsx) and therefore
 * sits outside KioskShell, whose `[data-kiosk]` rules only reach its own
 * descendants — so kiosk mode cannot hide the panel the way it hides the
 * navbar, sidebar and footer. Left alone, a kiosk dashboard opens with the
 * panel already expanded (HarnessChatProvider starts `isOpen`), losing a
 * quarter of the screen with no navbar toggle left to close it. Checking
 * kiosk here also keeps the skills fetch out of kiosk loads entirely.
 */
function KioskAwareHarnessChat(props: HarnessChatMountProps) {
  const isKiosk = useKioskMode();
  if (isKiosk) return null;
  return <HarnessChatPanel {...props} />;
}

export default function HarnessChatMount(props: HarnessChatMountProps) {
  // useKioskMode reads useSearchParams, which needs a Suspense boundary —
  // same wrapping KioskShell does for the same reason.
  return (
    <Suspense fallback={null}>
      <KioskAwareHarnessChat {...props} />
    </Suspense>
  );
}
