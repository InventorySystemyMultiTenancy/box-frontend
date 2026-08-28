import HeroSection from "@/components/landing/HeroSection";
import {
  Presentation,
  Differentiators,
  Services,
  ProcessSteps,
  Testimonials,
  Team,
  Partners,
  FinalCta,
  SiteFooter,
} from "@/components/landing/Sections";

// A seção "Equipe" busca a lista de mecânicos/admins (com foto de perfil) da API a
// cada request — sem isso, o Next congelaria essa lista no build e uma foto nova só
// apareceria depois do próximo deploy.
export const dynamic = "force-dynamic";

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
        <FinalCta />
        <SiteFooter />
      </HeroSection>
    </main>
  );
}
