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

export type PartAxle = "dianteiro" | "traseiro";
export type PartSide = "esquerdo" | "direito" | "ambos";

function normalize(text: string) {
  return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

/** Eixo/lado deduzidos do texto ("lado esquerdo dianteiro", "lateral traseira") — "" se não houver. */
export function inferPosition(text: string): { axle: PartAxle | ""; side: PartSide | "" } {
  const t = normalize(text);
  const axle = /dianteir|frente/.test(t) ? "dianteiro" : /traseir|atras/.test(t) ? "traseiro" : "";
  const side = /ambos os lados/.test(t) ? "ambos" : /esquerd|motorista/.test(t) ? "esquerdo" : /direit|passageiro/.test(t) ? "direito" : "";
  return { axle, side };
}

const AXLE_WORD = { dianteiro: "dianteir", traseiro: "traseir" } as const;
const SIDE_WORD = { esquerdo: "esquerd", direito: "direit" } as const;

/**
 * Troca as palavras de posição no texto (mantendo gênero/plural): "Amassado na lateral
 * dianteira" → "Amassado na lateral traseira". Sem palavra de posição, devolve igual.
 */
export function swapPositionWords(text: string, to: { axle: PartAxle | ""; side: PartSide | "" }) {
  let out = text;
  if (to.axle) {
    const target = AXLE_WORD[to.axle];
    out = out.replace(/(dianteir|traseir)(?=[oa]s?\b)/gi, (match) => (match[0] === match[0].toUpperCase() ? target[0].toUpperCase() + target.slice(1) : target));
  }
  if (to.side === "esquerdo" || to.side === "direito") {
    const target = SIDE_WORD[to.side];
    out = out.replace(/(esquerd|direit)(?=[oa]s?\b)/gi, (match) => (match[0] === match[0].toUpperCase() ? target[0].toUpperCase() + target.slice(1) : target));
  }
  return out;
}
