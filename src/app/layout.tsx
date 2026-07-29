import type { Metadata } from "next";
import { AuthProvider } from "@/lib/auth-context";
import "./globals.css";

export const metadata: Metadata = {
  title: "BOX. — Oficina que você acompanha em tempo real",
  description:
    "Acompanhe a manutenção do seu veículo em tempo real: diagnóstico, peças, aprovação digital e timeline completa.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
