"use client";

import { FileSpreadsheet, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ExportColumn, exportCsv, exportFilename, exportPdf } from "@/lib/export";

/** Botões "Excel" e "PDF" para qualquer lista — exporta exatamente as linhas passadas (já filtradas na tela). */
export function ExportButtons<T>({
  title,
  filename,
  columns,
  rows,
  subtitle,
}: {
  title: string;
  filename: string;
  columns: ExportColumn<T>[];
  rows: T[];
  subtitle?: string;
}) {
  const disabled = rows.length === 0;
  return (
    <div className="inline-flex gap-2">
      <Button type="button" variant="outline" size="sm" disabled={disabled} onClick={() => exportCsv(exportFilename(filename), columns, rows)} title="Baixar planilha (abre no Excel)">
        <FileSpreadsheet className="size-4" />
        Excel
      </Button>
      <Button type="button" variant="outline" size="sm" disabled={disabled} onClick={() => exportPdf(title, columns, rows, subtitle)} title="Gerar PDF para imprimir ou salvar">
        <FileText className="size-4" />
        PDF
      </Button>
    </div>
  );
}
