"use client";

import { useState } from "react";
import { FileSpreadsheet, FileText } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ExportColumn, exportCsv, exportFilename, exportPdf } from "@/lib/export";

/**
 * Botões "Excel" e "PDF" para qualquer lista — exporta exatamente as linhas passadas (já
 * filtradas na tela). Lista com "Ver mais" (só 10 na tela): passe `loadRows`, que busca
 * todas as linhas do filtro no banco na hora de exportar.
 */
export function ExportButtons<T>({
  title,
  filename,
  columns,
  rows,
  loadRows,
  subtitle,
}: {
  title: string;
  filename: string;
  columns: ExportColumn<T>[];
  rows: T[];
  loadRows?: () => Promise<T[]>;
  subtitle?: string;
}) {
  const [loading, setLoading] = useState(false);
  const disabled = rows.length === 0 || loading;

  async function run(action: (all: T[]) => void) {
    if (!loadRows) return action(rows);
    setLoading(true);
    try {
      action(await loadRows());
    } catch {
      toast.error("Não foi possível carregar a lista para exportar.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="inline-flex gap-2">
      <Button type="button" variant="outline" size="sm" disabled={disabled} onClick={() => run((all) => exportCsv(exportFilename(filename), columns, all))} title="Baixar planilha (abre no Excel)">
        <FileSpreadsheet className="size-4" />
        Excel
      </Button>
      <Button type="button" variant="outline" size="sm" disabled={disabled} onClick={() => run((all) => exportPdf(title, columns, all, subtitle))} title="Gerar PDF para imprimir ou salvar">
        <FileText className="size-4" />
        PDF
      </Button>
    </div>
  );
}
