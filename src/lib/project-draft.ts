// Rascunho do form "Novo projeto": sobrevive a fechar o form, trocar de aba, recarregar a
// página ou o celular desligar. Campos de texto ficam no localStorage; fotos/vídeos do
// checklist (arquivos grandes) no IndexedDB. Tudo por usuário e só neste aparelho.

const TEXT_PREFIX = "box:new-project-draft:";
const DB_NAME = "box-drafts";
const STORE = "files";

export function loadDraftText<T>(userId: string): (T & { savedAt: number }) | null {
  try {
    const raw = localStorage.getItem(TEXT_PREFIX + userId);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveDraftText<T>(userId: string, data: T) {
  try {
    localStorage.setItem(TEXT_PREFIX + userId, JSON.stringify({ ...data, savedAt: Date.now() }));
  } catch {
    // Sem espaço/modo privado: o rascunho só não é salvo.
  }
}

export function clearDraftText(userId: string) {
  try {
    localStorage.removeItem(TEXT_PREFIX + userId);
  } catch {
    // ignora
  }
}

function openDb(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

export type DraftFiles = { photos: File[]; videos: File[] };

export async function loadDraftFiles(userId: string): Promise<DraftFiles | null> {
  const db = await openDb();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const req = db.transaction(STORE, "readonly").objectStore(STORE).get(userId);
      req.onsuccess = () => resolve((req.result as DraftFiles | undefined) ?? null);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

export async function saveDraftFiles(userId: string, files: DraftFiles) {
  const db = await openDb();
  if (!db) return;
  try {
    const store = db.transaction(STORE, "readwrite").objectStore(STORE);
    if (files.photos.length === 0 && files.videos.length === 0) store.delete(userId);
    else store.put(files, userId);
  } catch {
    // Sem espaço para os arquivos: o restante do rascunho continua salvo.
  }
}

export async function clearDraft(userId: string) {
  clearDraftText(userId);
  await saveDraftFiles(userId, { photos: [], videos: [] });
}
