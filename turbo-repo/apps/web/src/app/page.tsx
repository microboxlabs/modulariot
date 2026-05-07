import { HeroSection } from "@/features/marketing/components/hero-section";
import { MarqueeSection } from "@/features/marketing/components/marquee-section";
import { TelemetrySymptomsSection } from "@/features/marketing/components/telemetry-symptoms-section";
import { FeatureBentoSection } from "@/features/marketing/components/feature-bento-section";
import { FrameworkBannerSection } from "@/features/marketing/components/framework-banner-section";
import { DashboardShowcaseSection } from "@/features/marketing/components/dashboard-showcase-section";
import { QuickStartSection } from "@/features/marketing/components/quick-start-section";
import { CommunitySection } from "@/features/marketing/components/community-section";
import { FinalCtaSection } from "@/features/marketing/components/final-cta-section";

export default function HomePage() {
  return (
    <main id="main" tabIndex={-1} className="focus:outline-none">
      <HeroSection />
      <MarqueeSection />
      <TelemetrySymptomsSection />
      <FeatureBentoSection />
      <FrameworkBannerSection />
      <DashboardShowcaseSection />
      <QuickStartSection />
      <CommunitySection />
      <FinalCtaSection />
    </main>
  );
}
