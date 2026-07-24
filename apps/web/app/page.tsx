import { AppShell } from '@/components/brand/AppShell';
import { Hero } from '@/components/landing/Hero';
import { FeatureSection } from '@/components/landing/FeatureSection';

export default function HomePage() {
  return (
    <AppShell>
      <Hero />
      <FeatureSection />
    </AppShell>
  );
}
