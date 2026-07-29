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
