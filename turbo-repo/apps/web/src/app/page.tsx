import { HeroSection } from "@/features/marketing/components/hero-section";
import { MarqueeSection } from "@/features/marketing/components/marquee-section";
import { TelemetrySymptomsSection } from "@/features/marketing/components/telemetry-symptoms-section";
import { FeatureBentoSection } from "@/features/marketing/components/feature-bento-section";
import { ArchitectureSection } from "@/features/marketing/components/architecture-section";
import { DomainStripSection } from "@/features/marketing/components/domain-strip-section";
import { FrameworkBannerSection } from "@/features/marketing/components/framework-banner-section";
import { DashboardShowcaseSection } from "@/features/marketing/components/dashboard-showcase-section";
import { ExamplesGallerySection } from "@/features/marketing/components/examples-gallery-section";
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
      <ArchitectureSection />
      <DomainStripSection />
      <DashboardShowcaseSection />
      <ExamplesGallerySection />
      <QuickStartSection />
      <CommunitySection />
      <FinalCtaSection />
    </main>
  );
}
