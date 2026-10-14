"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { api, ApiError } from "@/lib/api";
import { AssignableStaff, ServiceOrderAssignee } from "@/lib/types";
import { Checkbox } from "@/components/ui/checkbox";
import styles from "./dashboard.module.css";

/**
 * Funcionários associados ao projeto. Admin escolhe quantos quiser (vários ao mesmo
 * tempo); funcionário não-admin só enxerga os projetos em que está associado, e aqui só
 * vê a lista. Quem cria o projeto já entra associado (backend).
 */
export default function OrderAssigneesPanel({
  orderId,
  assignees,
  isAdmin,
  onChange,
}: {
  orderId: string;
  assignees: ServiceOrderAssignee[];
  isAdmin: boolean;
  onChange: (assignees: ServiceOrderAssignee[]) => void;
}) {
  const { token } = useAuth();
  const [editing, setEditing] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const { data: staff } = useQuery({
    queryKey: ["assignable-staff"],
    queryFn: async () => (await api.assignableStaff(token!)).staff as AssignableStaff[],
    enabled: !!token && isAdmin && editing,
  });

  function startEditing() {
    setSelected(assignees.map((a) => a.userId));
    setEditing(true);
  }

  function toggle(userId: string, checked: boolean) {
    setSelected((prev) => (checked ? [...prev, userId] : prev.filter((id) => id !== userId)));
  }

  async function save() {
    if (!token) return;
    setBusy(true);
    try {
      const result = await api.setOrderAssignees(orderId, selected, token);
      onChange(result.assignees as ServiceOrderAssignee[]);
      setEditing(false);
      toast.success("Funcionários do projeto atualizados.");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Não foi possível salvar os funcionários do projeto.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={styles.panel} style={{ marginBottom: "1.6rem" }}>
      <h2>Funcionários do projeto</h2>
      {!editing ? (
        <>
          <p className={styles.tlSub}>
            {assignees.length ? assignees.map((a) => a.user.name).join(", ") : "Nenhum funcionário associado — só administradores veem este projeto."}
          </p>
          {isAdmin && (
            <div className={styles.approvalActions}>
              <button className={styles.btnApprove} type="button" onClick={startEditing}>
                Associar funcionários
              </button>
            </div>
          )}
        </>
      ) : (
        <>
          {!staff ? (
            <p className={styles.tlSub}>Carregando funcionários...</p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2" style={{ marginBottom: "0.8rem" }}>
              {staff.map((member) => (
                <label key={member.id} className="flex items-center gap-2 text-sm">
                  <Checkbox checked={selected.includes(member.id)} onCheckedChange={(checked) => toggle(member.id, checked === true)} />
                  <span>
                    {member.name} <span className={styles.tlSub}>· {member.roleLabel}</span>
                  </span>
                </label>
              ))}
            </div>
          )}
          <div className={styles.approvalActions}>
            <button className={styles.btnApprove} type="button" disabled={busy || !staff} onClick={save}>
              {busy ? "Salvando..." : "Salvar"}
            </button>
            <button className={styles.btnApprove} type="button" disabled={busy} onClick={() => setEditing(false)}>
              Cancelar
            </button>
          </div>
        </>
      )}
    </div>
  );
}
