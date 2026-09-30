import type { Metadata } from "next";
import { AuthProvider } from "@/lib/auth-context";
import { QueryProvider } from "@/lib/query-provider";
import LoginIntroOverlay from "@/components/LoginIntroOverlay";
import "./globals.css";

const TITLE = "Reblind — Oficina que você acompanha em tempo real";
const DESCRIPTION =
  "Acompanhe a manutenção do seu veículo em tempo real: diagnóstico, peças, aprovação digital e timeline completa.";

export const metadata: Metadata = {
  // Resolve as imagens de og:image/twitter:image (arquivos opengraph-image.png e
  // twitter-image.png nesta mesma pasta) pra URL absoluta certa — sem isso, prévia de
  // link em WhatsApp/Slack/etc. podia cair pro favicon genérico (foi assim que a logo
  // da Vercel, do scaffold inicial e nunca trocada, aparecia em vez da da Reblind).
  metadataBase: new URL("https://boxmecanica.selfmachine.com.br"),
  title: TITLE,
  description: DESCRIPTION,
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    siteName: "Reblind",
    locale: "pt_BR",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>
        <QueryProvider>
          <AuthProvider>
            {children}
            <LoginIntroOverlay />
          </AuthProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
