// Lado/eixo de um problema (freio, pneu, suspensão). Não há coluna própria: fica no texto
// do nome ("Freios dianteiro lado esquerdo") e da observação ("Local: dianteiro lado
// esquerdo. ..."), que é o que o modelo do veículo usa para posicionar a bolinha.

export const POSITION_REQUIRED_PARTS = new Set(["pneus", "freios", "suspensao"]);

export const AXLE_LABEL: Record<string, string> = {
  dianteiro: "dianteiro",
  traseiro: "traseiro",
};

export const SIDE_LABEL: Record<string, string> = {
  esquerdo: "lado esquerdo",
  direito: "lado direito",
  ambos: "ambos os lados",
};

export function positionText(axle: string, side: string) {
  return `${AXLE_LABEL[axle]} ${SIDE_LABEL[side]}`;
}

const POSITION_SUFFIX = /\s+(dianteiro|traseiro)\s+(lado esquerdo|lado direito|ambos os lados)\s*$/i;
const LOCAL_PREFIX = /^Local:\s*[^.]*\.\s*/i;

/** Separa "Freios dianteiro lado esquerdo" em nome-base + eixo + lado. */
export function parsePartPosition(name: string): { baseName: string; axle: string; side: string } {
  const match = name.match(POSITION_SUFFIX);
  if (!match) return { baseName: name.trim(), axle: "dianteiro", side: "esquerdo" };
  const side = Object.entries(SIDE_LABEL).find(([, label]) => label === match[2].toLowerCase())?.[0] ?? "esquerdo";
  return { baseName: name.slice(0, match.index).trim(), axle: match[1].toLowerCase(), side };
}

/** Observação sem o prefixo "Local: ...." — o lado é regravado à parte. */
export function stripLocalPrefix(note: string) {
  return note.replace(LOCAL_PREFIX, "").trim();
}

/** Nome e observação com o novo lado, no mesmo formato usado ao cadastrar o problema. */
export function withPosition(baseName: string, note: string, axle: string, side: string) {
  const position = positionText(axle, side);
  const rest = stripLocalPrefix(note);
  return { name: `${baseName} ${position}`, description: `Local: ${position}.${rest ? ` ${rest}` : ""}` };
}
