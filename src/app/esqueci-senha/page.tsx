"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { api, ApiError } from "@/lib/api";
import styles from "../login/login.module.css";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await api.forgotPassword(email);
      setSent(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não foi possível enviar agora. Tente de novo.");
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
        <h1 className={styles.title}>Esqueci minha senha</h1>
        <p className={styles.lede}>Informe o e-mail da sua conta. Enviaremos um link para você criar uma senha nova.</p>

        {sent ? (
          <div className={styles.success}>
            Se existir uma conta com <strong>{email}</strong>, o link chega em alguns minutos. Confira também a caixa de spam.
            O link vale por 1 hora.
          </div>
        ) : (
          <>
            <div className={styles.field}>
              <label htmlFor="email">E-mail</label>
              <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            {error && <div className={styles.error}>{error}</div>}
            <button className={styles.submit} type="submit" disabled={loading}>
              {loading ? "Enviando..." : "Enviar link"}
            </button>
          </>
        )}
      </form>
    </div>
  );
}
