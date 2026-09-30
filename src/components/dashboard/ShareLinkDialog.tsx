"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Share2, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useAuth } from "@/lib/auth-context";
import { api, ApiError } from "@/lib/api";

// Link público (sem login) pra quem não quer criar conta só pra acompanhar o próprio
// projeto — só leitura, só desta ordem, válido por até 30 dias. Ver /acompanhar/[token]
// (página pública) e /api/public/share/:token (backend, sem requireAuth) no outro lado.
export function ShareLinkDialog({ orderId }: { orderId: string }) {
  const { token } = useAuth();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [link, setLink] = useState<{ token: string; expiresAt: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [revoking, setRevoking] = useState(false);

  async function loadOrCreate() {
    if (!token) return;
    setLoading(true);
    setLink(null);
    try {
      const { link: existing } = await api.getShareLink(orderId, token);
      const active = existing ?? (await api.createShareLink(orderId, token)).link;
      setLink(active);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Não foi possível gerar o link.");
    } finally {
      setLoading(false);
    }
  }

  function handleOpenChange(next: boolean) {
    setOpen(next);
    setCopied(false);
    if (next) loadOrCreate();
  }

  const shareUrl = link && typeof window !== "undefined" ? `${window.location.origin}/acompanhar/${link.token}` : "";

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      toast.success("Link copiado.");
    } catch {
      toast.error("Não foi possível copiar — selecione e copie manualmente.");
    }
  }

  async function handleRevoke() {
    if (!token) return;
    setRevoking(true);
    try {
      await api.revokeShareLink(orderId, token);
      toast.success("Link revogado.");
      await loadOrCreate();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Não foi possível revogar o link.");
    } finally {
      setRevoking(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" type="button">
          <Share2 className="size-4" />
          Compartilhar
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Link de acompanhamento</DialogTitle>
          <DialogDescription>
            Qualquer pessoa com este link vê etapa, peças, fotos e preço deste projeto, sem precisar de conta. Não dá
            pra alterar nada nem ver outra aba do sistema. Válido por 30 dias.
          </DialogDescription>
        </DialogHeader>
        {loading ? (
          <p className="text-sm text-muted-foreground">Gerando link...</p>
        ) : link ? (
          <div className="grid gap-3">
            <div className="flex items-center gap-2">
              <Input readOnly value={shareUrl} onFocus={(e) => e.target.select()} />
              <Button type="button" size="icon" variant="outline" onClick={copyLink} aria-label="Copiar link">
                {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">Expira em {new Date(link.expiresAt).toLocaleDateString("pt-BR")}.</p>
            <Button type="button" variant="ghost" className="w-fit text-destructive" disabled={revoking} onClick={handleRevoke}>
              {revoking ? "Revogando..." : "Revogar e gerar um novo link"}
            </Button>
          </div>
        ) : (
          <p className="text-sm text-destructive">Não foi possível gerar o link agora.</p>
        )}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
