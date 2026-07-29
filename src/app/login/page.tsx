"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { ApiError } from "@/lib/api";
import styles from "./login.module.css";

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("cliente@box.demo");
  const [password, setPassword] = useState("cliente123");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(email, password);
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não foi possível entrar.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles.wrap}>
      <form className={styles.card} onSubmit={handleSubmit}>
        <div className={styles.brand}>BOX.</div>
        <h1 className={styles.title}>Área do cliente</h1>
        <p className={styles.lede}>Acompanhe a manutenção do seu veículo em tempo real.</p>

        <div className={styles.field}>
          <label htmlFor="email">E-mail</label>
          <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <div className={styles.field}>
          <label htmlFor="password">Senha</label>
          <input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </div>

        {error && <div className={styles.error}>{error}</div>}

        <button className={styles.submit} type="submit" disabled={loading}>
          {loading ? "Entrando..." : "Entrar"}
        </button>

        <div className={styles.hint}>
          demo: cliente@box.demo / cliente123
          <br />
          mecânico: diego@box.demo / mecanico123
        </div>
      </form>
    </div>
  );
}
