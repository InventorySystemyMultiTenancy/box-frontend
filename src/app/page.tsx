import { Inter, JetBrains_Mono, Sora } from "next/font/google";
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

// Fontes só da página inicial (o painel continua com a fonte do sistema).
const display = Sora({ subsets: ["latin"], variable: "--font-landing-display", weight: ["400", "600", "700", "800"] });
const body = Inter({ subsets: ["latin"], variable: "--font-landing-body" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-landing-mono", weight: ["400", "600"] });

export default function LandingPage() {
  return (
    <main className={`${display.variable} ${body.variable} ${mono.variable}`}>
      {/* Narrativa: apresentação → engenharia/serviços → processo → tecnologia → confiança → conversão. */}
      <HeroSection>
        <Services />
        <ProcessSteps />
        <Differentiators />
        <Presentation />
        <Testimonials />
        <Team />
        <Partners />
        <FinalCta />
        <SiteFooter />
      </HeroSection>
    </main>
  );
}
