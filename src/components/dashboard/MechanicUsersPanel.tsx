"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import { User, Role } from "@/lib/types";
import styles from "./dashboard.module.css";

export default function MechanicUsersPanel() {
  const { token } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [userForm, setUserForm] = useState({
    name: "",
    email: "",
    password: "",
    phone: "",
    role: "CUSTOMER" as "CUSTOMER" | "MECHANIC" | "ADMIN",
    roleId: "",
    commissionRate: "",
  });
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function loadUsers() {
    if (!token) return;
    api.users(token).then(({ users }) => setUsers(users as User[]));
    api.roles(token).then(({ roles }) => setRoles(roles as Role[])).catch(() => {});
  }

  useEffect(loadUsers, [token]);

  async function createUser(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;
    setBusy(true);
    setMessage(null);
    try {
      const { user: created } = await api.createUser(
        {
          ...userForm,
          phone: userForm.phone || undefined,
          roleId: userForm.roleId || undefined,
          commissionRate: userForm.commissionRate ? Number(userForm.commissionRate) / 100 : undefined,
        },
        token
      );
      setUsers((prev) => [created as User, ...prev]);
      setUserForm({ name: "", email: "", password: "", phone: "", role: "CUSTOMER", roleId: "", commissionRate: "" });
      setMessage("Usuário criado.");
    } catch {
      setMessage("Não foi possível criar o usuário.");
    } finally {
      setBusy(false);
    }
  }

  async function updateUser(user: User, role: User["role"]) {
    if (!token) return;
    const { user: updated } = await api.updateUser(user.id, { role }, token);
    setUsers((prev) => prev.map((item) => (item.id === user.id ? (updated as User) : item)));
  }

  async function updateUserCargo(user: User, roleId: string) {
    if (!token) return;
    const { user: updated } = await api.updateUser(user.id, { roleId: roleId || null }, token);
    setUsers((prev) => prev.map((item) => (item.id === user.id ? (updated as User) : item)));
  }

  async function updateUserCommission(user: User, commissionPercent: string) {
    if (!token) return;
    const commissionRate = commissionPercent ? Number(commissionPercent) / 100 : null;
    const { user: updated } = await api.updateUser(user.id, { commissionRate }, token);
    setUsers((prev) => prev.map((item) => (item.id === user.id ? (updated as User) : item)));
  }

  return (
    <div className={styles.content}>
      <div className={styles.sectionTitle}>Administração de usuários</div>
      <div className={styles.panel}>
        <form className={styles.formGrid} onSubmit={createUser}>
          <label>
            Nome
            <input value={userForm.name} onChange={(e) => setUserForm((prev) => ({ ...prev, name: e.target.value }))} required />
          </label>
          <label>
            E-mail
            <input type="email" value={userForm.email} onChange={(e) => setUserForm((prev) => ({ ...prev, email: e.target.value }))} required />
          </label>
          <label>
            Senha
            <input type="password" minLength={6} value={userForm.password} onChange={(e) => setUserForm((prev) => ({ ...prev, password: e.target.value }))} required />
          </label>
          <label>
            Telefone
            <input value={userForm.phone} onChange={(e) => setUserForm((prev) => ({ ...prev, phone: e.target.value }))} />
          </label>
          <label className={styles.fullField}>
            Perfil
            <select value={userForm.role} onChange={(e) => setUserForm((prev) => ({ ...prev, role: e.target.value as User["role"] }))}>
              <option value="CUSTOMER">Cliente</option>
              <option value="MECHANIC">Mecânico</option>
              <option value="ADMIN">Admin</option>
            </select>
          </label>
          <label className={styles.fullField}>
            Cargo
            <select value={userForm.roleId} onChange={(e) => setUserForm((prev) => ({ ...prev, roleId: e.target.value }))}>
              <option value="">Sem cargo</option>
              {roles.map((role) => (
                <option key={role.id} value={role.id}>
                  {role.name}
                </option>
              ))}
            </select>
          </label>
          {userForm.role === "MECHANIC" && (
            <label>
              Comissão (%)
              <input
                type="number"
                min="0"
                max="100"
                step="0.1"
                value={userForm.commissionRate}
                onChange={(e) => setUserForm((prev) => ({ ...prev, commissionRate: e.target.value }))}
                placeholder="ex: 10"
              />
            </label>
          )}
          {message && <div className={styles.formMessage}>{message}</div>}
          <button className={styles.actionButton} type="submit" disabled={busy}>
            {busy ? "Criando..." : "Criar usuário"}
          </button>
        </form>
      </div>

      <div className={styles.sectionTitle}>Usuários existentes</div>
      <div className={styles.ordersList}>
        {users.map((user) => (
          <div key={user.id} className={styles.orderRow}>
            <div className={styles.orderRowInfo}>
              <strong>{user.name}</strong>
              <span>{user.email}</span>
            </div>
            <select value={user.role} onChange={(e) => updateUser(user, e.target.value as User["role"])}>
              <option value="CUSTOMER">Cliente</option>
              <option value="MECHANIC">Mecânico</option>
              <option value="ADMIN">Admin</option>
            </select>
            <select value={user.roleId ?? ""} onChange={(e) => updateUserCargo(user, e.target.value)}>
              <option value="">Sem cargo</option>
              {roles.map((role) => (
                <option key={role.id} value={role.id}>
                  {role.name}
                </option>
              ))}
            </select>
            {user.role === "MECHANIC" && (
              <input
                type="number"
                min="0"
                max="100"
                step="0.1"
                style={{ width: 90 }}
                defaultValue={user.commissionRate != null ? user.commissionRate * 100 : ""}
                onBlur={(e) => updateUserCommission(user, e.target.value)}
                placeholder="Comissão %"
                title="Percentual de comissão"
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
