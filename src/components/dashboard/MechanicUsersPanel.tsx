"use client";

import { useEffect, useState } from "react";
import { Percent, Eye, EyeOff } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import { User, Role } from "@/lib/types";
import { UserFormDialog } from "@/components/dashboard/users/UserFormDialog";
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
  const [showPassword, setShowPassword] = useState(false);

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

  function handleUserSaved(updated: User) {
    setUsers((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
  }

  const ROLE_LABELS: Record<User["role"], string> = { CUSTOMER: "Cliente", MECHANIC: "Mecânico", ADMIN: "Admin" };

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
            <div style={{ position: "relative", display: "flex" }}>
              <input
                type={showPassword ? "text" : "password"}
                minLength={6}
                value={userForm.password}
                onChange={(e) => setUserForm((prev) => ({ ...prev, password: e.target.value }))}
                required
                style={{ paddingRight: "2.2rem", width: "100%" }}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                style={{
                  position: "absolute",
                  right: "0.4rem",
                  top: "50%",
                  transform: "translateY(-50%)",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  display: "flex",
                  color: "var(--text-muted)",
                }}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
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

      <div className={styles.sectionTitle}>Usuários existentes ({users.length})</div>
      <div className={styles.usersTableWrap}>
        <table className={styles.usersTable}>
          <thead>
            <tr>
              <th>Nome</th>
              <th>Contato</th>
              <th>Perfil</th>
              <th>Cargo</th>
              <th>Comissão</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id}>
                <td>
                  <strong>{user.name}</strong>
                </td>
                <td>
                  <span>{user.email}</span>
                  {user.phone && <span> · {user.phone}</span>}
                </td>
                <td>{ROLE_LABELS[user.role]}</td>
                <td>{roles.find((r) => r.id === user.roleId)?.name ?? "Sem cargo"}</td>
                <td>
                  {user.role === "MECHANIC" ? (
                    <div className={styles.commissionField}>
                      <Percent size={13} className={styles.commissionIcon} />
                      <span>{user.commissionRate != null ? `${(user.commissionRate * 100).toFixed(1)}%` : "—"}</span>
                    </div>
                  ) : (
                    <span>—</span>
                  )}
                </td>
                <td>
                  <UserFormDialog
                    user={user}
                    roles={roles}
                    onSaved={handleUserSaved}
                    trigger={
                      <button type="button" className={styles.linkButton}>
                        Editar
                      </button>
                    }
                  />
                </td>
              </tr>
            ))}
            {users.length === 0 && (
              <tr>
                <td colSpan={6} className={styles.usersTableEmpty}>
                  Nenhum usuário cadastrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
