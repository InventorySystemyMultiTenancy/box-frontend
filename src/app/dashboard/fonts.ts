import { Inter, JetBrains_Mono, Sora } from "next/font/google";

// Mesmas fontes da página inicial — o painel usa o mesmo design system premium.
export const dashDisplay = Sora({ subsets: ["latin"], variable: "--font-landing-display", weight: ["400", "600", "700", "800"] });
export const dashBody = Inter({ subsets: ["latin"], variable: "--font-landing-body" });
export const dashMono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-landing-mono", weight: ["400", "600"] });

export const DASH_FONT_CLASSES = [dashDisplay.variable, dashBody.variable, dashMono.variable];
