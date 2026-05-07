import { HeroSection } from "@/features/marketing/components/hero-section";
import { TelemetrySymptomsSection } from "@/features/marketing/components/telemetry-symptoms-section";
import { FeatureBentoSection } from "@/features/marketing/components/feature-bento-section";
import { ArchitectureSection } from "@/features/marketing/components/architecture-section";

export default function HomePage() {
  return (
    <main>
      <HeroSection />
      <TelemetrySymptomsSection />
      <FeatureBentoSection />
      <ArchitectureSection />
    </main>
  );
}
