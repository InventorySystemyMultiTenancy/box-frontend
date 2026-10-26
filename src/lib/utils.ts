import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Busca simples client-side (Caminhões — lista, movimentações, abastecimentos — e lista de
// projetos): minúsculas, sem acento e palavra por palavra — cada palavra digitada precisa
// estar em algum dos campos, juntos. "VOLKSWAGEM DELIVERY" acha o veículo com marca
// "VOLKSWAGEM" e modelo "DELIVERY" (antes procurava a frase inteira num campo só e não
// achava). Também compara só letras e números: placa "ABC-1234" sai com "abc1234" ou
// "abc 1234" — ninguém digita o traço.
export function matchesSearch(query: string, fields: (string | null | undefined)[]): boolean {
  const q = query.trim();
  if (!q) return true;
  const normalize = (s: string) =>
    s
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .toLowerCase();
  const compact = (s: string) => normalize(s).replace(/[^a-z0-9]/g, "");
  const haystack = fields.filter(Boolean).map((f) => normalize(f!)).join(" ");
  const compactHaystack = compact(haystack);
  // Frase toda junta (ex.: placa digitada com espaço no meio) ou palavra por palavra.
  if (compact(q) && compactHaystack.includes(compact(q))) return true;
  const words = normalize(q).split(/\s+/).filter(Boolean);
  return words.every((word) => haystack.includes(word) || (compact(word).length > 0 && compactHaystack.includes(compact(word))));
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
