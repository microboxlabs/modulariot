import Header from '../../../components/Header';
import PromoRibbon from '../../../components/sections/PromoRibbon';
import HeroSection from '../../../components/sections/HeroSection';
import LogoWall from '../../../components/sections/LogoWall';
import FeatureBento from '../../../components/sections/FeatureBento';
import FrameworkBanner from '../../../components/sections/FrameworkBanner';
import CustomerStories from '../../../components/sections/CustomerStories';
import QuickStartGallery from '../../../components/sections/QuickStartGallery';
import DashboardShowcase from '../../../components/sections/DashboardShowcase';
import CommunityTweets from '../../../components/sections/CommunityTweets';
import PricingSection from '../../../components/sections/PricingSection';
import FinalCTASection from '../../../components/sections/FinalCTASection';
import SecurityStrip from '../../../components/sections/SecurityStrip';
import MegaFooter from '../../../components/sections/MegaFooter';
import { getDictionary } from './dictionaries';

export default async function Home({
  params,
}: {
  params: Promise<{ lang: 'en' | 'es' | 'pt' }>;
}) {
  const { lang } = await params;
  const dict = await getDictionary(lang);
  
  return (
    <>
      <PromoRibbon />
      <Header dict={dict} />
      <main>
        <HeroSection dict={dict} />
        <LogoWall />
        <FeatureBento />
        <FrameworkBanner />
        <CustomerStories />
        <QuickStartGallery />
        <DashboardShowcase />
        <CommunityTweets />
        <PricingSection />
        <FinalCTASection />
        <SecurityStrip />
      </main>
      <MegaFooter />
    </>
  );
}
