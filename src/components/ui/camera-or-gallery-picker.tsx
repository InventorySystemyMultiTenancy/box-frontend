"use client";

import { useRef } from "react";
import { Camera, Images } from "lucide-react";
import { Button } from "@/components/ui/button";

interface CameraOrGalleryPickerProps {
  onFiles: (files: File[]) => void;
  multiple?: boolean;
  disabled?: boolean;
  cameraLabel?: string;
  galleryLabel?: string;
}

// Dois botões em vez de um seletor só: no celular, o input com `capture` abre direto a
// câmera (sem galeria) e o sem `capture` costuma abrir só a galeria — assim a pessoa
// escolhe explicitamente entre tirar a foto na hora ou usar uma já existente.
export function CameraOrGalleryPicker({
  onFiles,
  multiple = false,
  disabled,
  cameraLabel = "Tirar foto",
  galleryLabel = "Escolher da galeria",
}: CameraOrGalleryPickerProps) {
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (files.length > 0) onFiles(files);
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Button type="button" variant="outline" size="sm" disabled={disabled} onClick={() => cameraRef.current?.click()}>
        <Camera className="size-4" />
        {cameraLabel}
      </Button>
      <Button type="button" variant="outline" size="sm" disabled={disabled} onClick={() => galleryRef.current?.click()}>
        <Images className="size-4" />
        {galleryLabel}
      </Button>
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleChange} />
      <input ref={galleryRef} type="file" accept="image/*" multiple={multiple} className="hidden" onChange={handleChange} />
    </div>
  );
}
