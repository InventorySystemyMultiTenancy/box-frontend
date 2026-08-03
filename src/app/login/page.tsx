"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { ApiError } from "@/lib/api";
import styles from "./login.module.css";

export default function LoginPage() {
  const { login, registerCustomer } = useAuth();
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("cliente@box.demo");
  const [password, setPassword] = useState("cliente123");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (mode === "login") {
        await login(email, password);
      } else {
        await registerCustomer({ name, email, password, phone: phone || undefined });
      }
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não foi possível completar a solicitação.");
    } finally {
      setLoading(false);
    }
  }

  function switchMode(nextMode: "login" | "register") {
    setMode(nextMode);
    setError(null);
    if (nextMode === "login") {
      setEmail("cliente@box.demo");
      setPassword("cliente123");
    } else {
      setEmail("");
      setPassword("");
    }
  }

  return (
    <div className={styles.wrap}>
      <video
        className={styles.bgVideo}
        src="/Car_engine_opened_showing_details_202607310943.mp4"
        autoPlay
        loop
        muted
        playsInline
        preload="auto"
      />
      <div className={styles.scrim} />
      <form className={styles.card} onSubmit={handleSubmit}>
        <Link href="/" className={styles.backLink}>
          Voltar ao site
        </Link>
        <div className={styles.brand}>BOX.</div>
        <h1 className={styles.title}>{mode === "login" ? "Área do cliente" : "Criar conta de cliente"}</h1>
        <p className={styles.lede}>
          {mode === "login"
            ? "Acompanhe a manutenção do seu veículo em tempo real."
            : "Cadastre-se como cliente para acessar seu painel quando houver uma ordem vinculada."}
        </p>

        <div className={styles.tabs}>
          <button type="button" className={mode === "login" ? styles.tabActive : ""} onClick={() => switchMode("login")}>
            Entrar
          </button>
          <button type="button" className={mode === "register" ? styles.tabActive : ""} onClick={() => switchMode("register")}>
            Criar conta
          </button>
        </div>

        {mode === "register" && (
          <>
            <div className={styles.field}>
              <label htmlFor="name">Nome</label>
              <input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div className={styles.field}>
              <label htmlFor="phone">Telefone</label>
              <input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
          </>
        )}

        <div className={styles.field}>
          <label htmlFor="email">E-mail</label>
          <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <div className={styles.field}>
          <label htmlFor="password">Senha</label>
          <input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
        </div>

        {error && <div className={styles.error}>{error}</div>}

        <button className={styles.submit} type="submit" disabled={loading}>
          {loading ? "Aguarde..." : mode === "login" ? "Entrar" : "Criar conta"}
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
