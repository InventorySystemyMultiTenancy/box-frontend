"use client";

import { useRef, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { API_URL } from "@/lib/api";
import styles from "@/components/dashboard/dashboard.module.css";

function mediaUrl(url: string) {
  return url.startsWith("http://") || url.startsWith("https://") ? url : `${API_URL}${url}`;
}

const ROLE_LABELS: Record<string, string> = {
  ADMIN: "Administrador",
  MECHANIC: "Mecânico",
  CUSTOMER: "Cliente",
};

export default function PerfilPage() {
  const { user, updateAvatar } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  if (!user) return null;

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPreview(URL.createObjectURL(file));
    setMessage(null);
  }

  async function handleSave() {
    const file = fileInputRef.current?.files?.[0];
    if (!file) return;
    setBusy(true);
    setMessage(null);
    try {
      await updateAvatar(file);
      setMessage("Foto atualizada.");
      setPreview(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch {
      setMessage("Não foi possível atualizar a foto.");
    } finally {
      setBusy(false);
    }
  }

  const avatarSrc = preview ?? (user.avatarUrl ? mediaUrl(user.avatarUrl) : null);

  return (
    <div className={styles.content}>
      <div className={styles.sectionTitle}>Meu perfil</div>
      <div className={styles.panel}>
        <div className={styles.avatarUploadRow}>
          {avatarSrc ? (
            <img src={avatarSrc} alt="" className={styles.avatarPreview} />
          ) : (
            <span className={styles.avatarPreview}>{(user.name?.[0] ?? "U").toUpperCase()}</span>
          )}
          <div className={styles.avatarUploadActions}>
            <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChange} />
            <button type="button" className={styles.actionButton} onClick={handleSave} disabled={busy || !preview}>
              {busy ? "Salvando..." : "Salvar foto"}
            </button>
          </div>
        </div>
        {message && <p className={styles.formMessage}>{message}</p>}

        <div className={styles.formGrid}>
          <label>
            Nome
            <input value={user.name} disabled />
          </label>
          <label>
            E-mail
            <input value={user.email} disabled />
          </label>
          <label>
            Cargo
            <input value={ROLE_LABELS[user.role] ?? user.role} disabled />
          </label>
        </div>
      </div>
    </div>
  );
}
