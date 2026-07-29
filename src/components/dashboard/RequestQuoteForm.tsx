"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { api, ApiError } from "@/lib/api";
import styles from "./dashboard.module.css";

export default function RequestQuoteForm({ onCreated }: { onCreated: () => void }) {
  const { token } = useAuth();
  const [form, setForm] = useState({
    brand: "",
    model: "",
    year: "",
    engine: "",
    plate: "",
    mileage: "",
    problemDescription: "",
    preferredDates: "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;
    setBusy(true);
    setError(null);
    try {
      await api.createQuoteRequest(
        {
          vehicle: {
            brand: form.brand,
            model: form.model,
            year: Number(form.year),
            engine: form.engine || undefined,
            plate: form.plate || undefined,
            mileage: form.mileage ? Number(form.mileage) : undefined,
          },
          problemDescription: form.problemDescription,
          preferredDates: form.preferredDates,
        },
        token
      );
      onCreated();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não foi possível enviar sua solicitação.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={styles.panel}>
      <h2>Solicitar orçamento</h2>
      <form className={styles.formGrid} onSubmit={handleSubmit}>
        <label>
          Marca
          <input value={form.brand} onChange={(e) => setForm((f) => ({ ...f, brand: e.target.value }))} required />
        </label>
        <label>
          Modelo
          <input value={form.model} onChange={(e) => setForm((f) => ({ ...f, model: e.target.value }))} required />
        </label>
        <label>
          Ano
          <input
            type="number"
            min="1950"
            max="2100"
            value={form.year}
            onChange={(e) => setForm((f) => ({ ...f, year: e.target.value }))}
            required
          />
        </label>
        <label>
          Motorização
          <input value={form.engine} onChange={(e) => setForm((f) => ({ ...f, engine: e.target.value }))} placeholder="opcional" />
        </label>
        <label>
          Placa
          <input value={form.plate} onChange={(e) => setForm((f) => ({ ...f, plate: e.target.value }))} placeholder="opcional" />
        </label>
        <label>
          Quilometragem
          <input
            type="number"
            min="0"
            value={form.mileage}
            onChange={(e) => setForm((f) => ({ ...f, mileage: e.target.value }))}
            placeholder="opcional"
          />
        </label>
        <label className={styles.fullField}>
          Qual o problema identificado?
          <textarea
            value={form.problemDescription}
            onChange={(e) => setForm((f) => ({ ...f, problemDescription: e.target.value }))}
            placeholder="Descreva o que você percebeu no veículo"
            required
          />
        </label>
        <label className={styles.fullField}>
          Quais dias você pode levar o carro?
          <input
            value={form.preferredDates}
            onChange={(e) => setForm((f) => ({ ...f, preferredDates: e.target.value }))}
            placeholder="Ex.: segunda ou quarta-feira pela manhã"
            required
          />
        </label>
        {error && <div className={styles.formMessage}>{error}</div>}
        <button className={styles.actionButton} type="submit" disabled={busy}>
          {busy ? "Enviando..." : "Enviar solicitação"}
        </button>
      </form>
    </div>
  );
}
