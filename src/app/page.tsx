import HeroSection from "@/components/landing/HeroSection";
import {
  Presentation,
  Differentiators,
  Services,
  ProcessSteps,
  Testimonials,
  Team,
  Partners,
  SchedulingCta,
  FinalCta,
  SiteFooter,
} from "@/components/landing/Sections";

export default function LandingPage() {
  return (
    <main>
      <HeroSection>
        <Presentation />
        <Differentiators />
        <Services />
        <ProcessSteps />
        <Testimonials />
        <Team />
        <Partners />
        <SchedulingCta />
        <FinalCta />
        <SiteFooter />
      </HeroSection>
    </main>
  );
}
