import { io, Socket } from "socket.io-client";
import { API_URL } from "@/lib/api";

let socket: Socket | undefined;

export function getSocket(): Socket {
  if (!socket) {
    socket = io(API_URL, { autoConnect: false });
  }
  return socket;
}

/** Conecta (se preciso) e entra na sala de eventos da ordem de serviço. */
export function joinOrderRoom(orderId: string, token: string) {
  const s = getSocket();
  if (!s.connected) s.connect();
  s.emit("join-order", { orderId, token });
}

/** Mesma sala de eventos da ordem, só que pelo token do link público de
 * acompanhamento (sem login) — usado em /acompanhar/[token]. */
export function joinOrderRoomByShareToken(shareToken: string) {
  const s = getSocket();
  if (!s.connected) s.connect();
  s.emit("join-order-public", { shareToken });
}

/** Sala pessoal do usuário — recebe atualizações da solicitação de orçamento
 * antes de existir uma ordem de serviço. */
export function joinUserRoom(token: string) {
  const s = getSocket();
  if (!s.connected) s.connect();
  s.emit("join-user", { token });
}

/** Sala da equipe — mecânico/admin acompanham novas solicitações e qualquer
 * ordem em andamento sem precisar entrar em cada sala individualmente. */
export function joinStaffRoom(token: string) {
  const s = getSocket();
  if (!s.connected) s.connect();
  s.emit("join-staff", { token });
}
