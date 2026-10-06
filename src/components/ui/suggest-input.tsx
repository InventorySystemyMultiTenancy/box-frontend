"use client";

import { useId } from "react";
import { Input } from "@/components/ui/input";

/**
 * Campo de texto com sugestões (datalist): escolhe um valor já cadastrado ou digita um
 * novo — usado em categoria/grupo/descrição/setor de despesa e fornecedor, onde o que é
 * digitado fica salvo para as próximas vezes.
 */
export function SuggestInput({
  options,
  ...props
}: Omit<React.ComponentProps<typeof Input>, "list"> & { options: string[] }) {
  const listId = useId();
  return (
    <>
      <Input list={listId} autoComplete="off" {...props} />
      <datalist id={listId}>
        {options.map((option) => (
          <option key={option} value={option} />
        ))}
      </datalist>
    </>
  );
}
