"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import styles from "./dashboard.module.css";

/** Cadastro de novos usuários (clientes ou outros mecânicos) pela equipe. */
export default function MechanicUsersPanel() {
  const { token } = useAuth();
  const [userForm, setUserForm] = useState({ name: "", email: "", password: "", phone: "", role: "CUSTOMER" as "CUSTOMER" | "MECHANIC" });
  const [userMessage, setUserMessage] = useState<string | null>(null);
  const [userBusy, setUserBusy] = useState(false);

  async function createUser(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;
    setUserBusy(true);
    setUserMessage(null);
    try {
      const { user: created } = await api.createUser({ ...userForm, phone: userForm.phone || undefined }, token);
      setUserForm({ name: "", email: "", password: "", phone: "", role: "CUSTOMER" });
      setUserMessage(`${created.name} criado como ${created.role === "MECHANIC" ? "mecânico" : "cliente"}.`);
    } catch {
      setUserMessage("Não foi possível criar o usuário.");
    } finally {
      setUserBusy(false);
    }
  }

  return (
    <div className={styles.content}>
      <div className={styles.sectionTitle}>Cadastrar novo usuário</div>
      <div className={styles.panel}>
        <form className={styles.formGrid} onSubmit={createUser}>
          <label>
            Nome
            <input value={userForm.name} onChange={(e) => setUserForm((prev) => ({ ...prev, name: e.target.value }))} required />
          </label>
          <label>
            E-mail
            <input
              type="email"
              value={userForm.email}
              onChange={(e) => setUserForm((prev) => ({ ...prev, email: e.target.value }))}
              required
            />
          </label>
          <label>
            Senha
            <input
              type="password"
              minLength={6}
              value={userForm.password}
              onChange={(e) => setUserForm((prev) => ({ ...prev, password: e.target.value }))}
              required
            />
          </label>
          <label>
            Telefone
            <input value={userForm.phone} onChange={(e) => setUserForm((prev) => ({ ...prev, phone: e.target.value }))} />
          </label>
          <label className={styles.fullField}>
            Perfil
            <select
              value={userForm.role}
              onChange={(e) => setUserForm((prev) => ({ ...prev, role: e.target.value as "CUSTOMER" | "MECHANIC" }))}
            >
              <option value="CUSTOMER">Cliente</option>
              <option value="MECHANIC">Mecânico</option>
            </select>
          </label>
          {userMessage && <div className={styles.formMessage}>{userMessage}</div>}
          <button className={styles.actionButton} type="submit" disabled={userBusy}>
            {userBusy ? "Criando..." : "Criar usuário"}
          </button>
        </form>
      </div>
    </div>
  );
}
