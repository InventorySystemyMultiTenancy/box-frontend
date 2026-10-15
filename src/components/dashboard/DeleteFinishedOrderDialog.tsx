"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { api, ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

/**
 * Exclusão definitiva de um projeto finalizado direto da lista "Ver finalizados" (ex.:
 * projeto de teste). Diferente de projeto em andamento, o backend aceita mesmo com nota,
 * comissão e contas — e apaga esse rastro financeiro junto. Confirmação digitando o código.
 */
export function DeleteFinishedOrderDialog({ order, onDeleted }: { order: { id: string; code: string }; onDeleted: (orderId: string) => void }) {
  const { token } = useAuth();
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) setCode("");
  }

  async function confirm() {
    if (!token) return;
    setBusy(true);
    try {
      await api.deleteServiceOrder(order.id, token);
      toast.success(`Projeto ${order.code} excluído definitivamente.`);
      setOpen(false);
      onDeleted(order.id);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Não foi possível excluir o projeto.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="shrink-0 text-destructive" aria-label={`Excluir projeto ${order.code}`} title="Excluir definitivamente">
          <Trash2 className="size-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Excluir definitivamente o projeto {order.code}?</DialogTitle>
          <DialogDescription>
            Apaga o projeto e tudo ligado a ele: timeline, problemas, fotos, mensagens, notas fiscais, comissões, contas a
            receber e lançamentos financeiros deste projeto. Não pode ser desfeito. Para confirmar, digite{" "}
            <strong>{order.code}</strong> abaixo.
          </DialogDescription>
        </DialogHeader>
        <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder={order.code} autoFocus />
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>
            Cancelar
          </Button>
          <Button variant="destructive" disabled={busy || code.trim() !== order.code} onClick={confirm}>
            {busy ? "Excluindo..." : "Excluir definitivamente"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
