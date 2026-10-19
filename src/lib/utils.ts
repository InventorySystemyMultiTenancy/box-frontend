import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Busca simples client-side: normaliza (minúsculas, sem acento) e checa se algum dos
// campos contém o termo — usado nas abas de Caminhões (lista, movimentações,
// abastecimentos) para filtrar por placa, nome do caminhão, motorista ou data.
export function matchesSearch(query: string, fields: (string | null | undefined)[]): boolean {
  const q = query.trim();
  if (!q) return true;
  const normalize = (s: string) =>
    s
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .toLowerCase();
  const nq = normalize(q);
  return fields.some((f) => f && normalize(f).includes(nq));
}

// Cliente cadastrado sem e-mail no novo projeto ganha um e-mail técnico neste domínio
// (ver createClientWithLogin no backend) — nunca deve aparecer como se fosse real.
const PLACEHOLDER_EMAIL_DOMAIN = "@sem-email.reblind.invalid";

export function isPlaceholderEmail(email: string | null | undefined) {
  return Boolean(email?.toLowerCase().endsWith(PLACEHOLDER_EMAIL_DOMAIN));
}

/** E-mail para exibir: "sem e-mail" no lugar do e-mail técnico. */
export function displayEmail(email: string | null | undefined) {
  return !email || isPlaceholderEmail(email) ? "sem e-mail" : email;
}
