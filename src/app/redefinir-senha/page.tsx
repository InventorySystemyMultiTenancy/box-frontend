"use client";

import { Suspense, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import { PasswordInput } from "@/components/ui/password-input";
import styles from "../login/login.module.css";

// useSearchParams exige um Suspense acima dele para a página poder ser pré-renderizada.
export default function ResetPasswordPageWrapper() {
  return (
    <Suspense>
      <ResetPasswordPage />
    </Suspense>
  );
}

// Destino do link enviado por e-mail em "Esqueci minha senha" (?token=...).
function ResetPasswordPage() {
  const resetToken = useSearchParams().get("token");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!resetToken) return;
    if (password !== confirm) {
      setError("As senhas não conferem.");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await api.resetPassword(resetToken, password);
      setDone(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não foi possível redefinir a senha.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles.wrap}>
      <form className={styles.card} onSubmit={handleSubmit}>
        <Link href="/login" className={styles.backLink}>
          Voltar ao login
        </Link>
        <div className={styles.brand}>
          <Image src="/reblindlogo.jpeg" alt="Reblind" width={124} height={124} className={styles.brandLogo} priority />
        </div>
        <h1 className={styles.title}>Criar nova senha</h1>

        {done ? (
          <>
            <div className={styles.success}>Senha alterada. Já pode entrar com a senha nova.</div>
            <Link href="/login" className={styles.submit} style={{ display: "block", textAlign: "center" }}>
              Ir para o login
            </Link>
          </>
        ) : resetToken === null ? (
          <div className={styles.error}>
            Link incompleto. Abra o link direto do e-mail ou peça outro em <Link href="/esqueci-senha">Esqueci minha senha</Link>.
          </div>
        ) : (
          <>
            <div className={styles.field}>
              <label htmlFor="password">Nova senha</label>
              <PasswordInput id="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
            </div>
            <div className={styles.field}>
              <label htmlFor="confirm">Repita a nova senha</label>
              <PasswordInput id="confirm" value={confirm} onChange={(e) => setConfirm(e.target.value)} required minLength={6} />
            </div>
            {error && <div className={styles.error}>{error}</div>}
            <button className={styles.submit} type="submit" disabled={loading}>
              {loading ? "Salvando..." : "Salvar nova senha"}
            </button>
          </>
        )}
      </form>
    </div>
  );
}
