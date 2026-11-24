import type { BankAccount } from "@/lib/types";

type AccountLike = Pick<BankAccount, "name" | "bank" | "agency" | "accountNumber">;

/**
 * Como a conta aparece ao escolher onde pagar/receber: o nome do BANCO (é o que a equipe
 * reconhece), não o apelido da conta. Sem banco cadastrado, cai no nome da conta. Duas
 * contas no mesmo banco ganham agência/conta para dar para diferenciar.
 */
export function bankAccountLabel(account: AccountLike, all: AccountLike[] = []): string {
  const bank = account.bank?.trim();
  if (!bank) return account.name;
  const sameBank = all.filter((other) => other.bank?.trim().toLowerCase() === bank.toLowerCase()).length > 1;
  if (!sameBank) return bank;
  const detail = [account.agency ? `Ag. ${account.agency}` : null, account.accountNumber ? `C/C ${account.accountNumber}` : null]
    .filter(Boolean)
    .join(" ");
  return `${bank} · ${detail || account.name}`;
}
