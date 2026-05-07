import { HeroSection } from "@/features/marketing/components/hero-section";
import { TelemetrySymptomsSection } from "@/features/marketing/components/telemetry-symptoms-section";
import { FeatureBentoSection } from "@/features/marketing/components/feature-bento-section";
import { ArchitectureSection } from "@/features/marketing/components/architecture-section";
import { DomainStripSection } from "@/features/marketing/components/domain-strip-section";
import { CompatibilityBannerSection } from "@/features/marketing/components/compatibility-banner-section";
import { DashboardShowcaseSection } from "@/features/marketing/components/dashboard-showcase-section";
import { ExamplesGallerySection } from "@/features/marketing/components/examples-gallery-section";

export default function HomePage() {
  return (
    <main>
      <HeroSection />
      <TelemetrySymptomsSection />
      <FeatureBentoSection />
      <ArchitectureSection />
      <DomainStripSection />
      <CompatibilityBannerSection />
      <DashboardShowcaseSection />
      <ExamplesGallerySection />
    </main>
  );
}
