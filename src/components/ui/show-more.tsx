"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";

// Listas do site: começam com 10 itens e "Ver mais" busca o resto no banco — a tela abre
// rápida mesmo com milhares de contas, projetos, notas etc.
export const LIST_PAGE_SIZE = 10;
// "Ver mais": tudo que o backend aceita numa página só (MAX_PAGE_SIZE em lib/pagination.ts).
export const ALL_PAGE_SIZE = 1000;

/**
 * Estado do "Ver mais" de uma lista paginada no servidor. `resetKey` = filtros/busca atuais:
 * mudou o filtro, a lista volta a mostrar só 10 (sem precisar de efeito).
 */
export function useShowMore(resetKey = "") {
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const showAll = expandedKey === resetKey;
  return {
    showAll,
    pageSize: showAll ? ALL_PAGE_SIZE : LIST_PAGE_SIZE,
    showMore: () => setExpandedKey(resetKey),
  };
}

/** Mesmo "Ver mais" para listas que já vêm inteiras: só desenha as 10 primeiras linhas. */
export function useVisibleItems<T>(items: T[] | undefined, resetKey = "") {
  const { showAll, showMore } = useShowMore(resetKey);
  const all = items ?? [];
  return {
    visible: showAll ? all : all.slice(0, LIST_PAGE_SIZE),
    shown: showAll ? all.length : Math.min(all.length, LIST_PAGE_SIZE),
    total: all.length,
    showMore,
  };
}

/** Botão "Ver mais" embaixo da lista — some quando tudo já está na tela. */
export function ShowMoreButton({
  shown,
  total,
  onClick,
  loading,
  noun = "itens",
}: {
  shown: number;
  total: number;
  onClick: () => void;
  loading?: boolean;
  noun?: string;
}) {
  if (shown >= total && !loading) return null;
  return (
    <div className="flex flex-col items-center gap-1 py-3">
      <Button type="button" variant="outline" size="sm" onClick={onClick} disabled={loading}>
        <ChevronDown className="size-4" />
        {loading ? "Carregando..." : "Ver mais"}
      </Button>
      <span className="text-xs text-muted-foreground">
        Mostrando {shown} de {total} {noun}
      </span>
    </div>
  );
}
