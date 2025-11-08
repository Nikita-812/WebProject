import { io, Socket } from "socket.io-client";
import { authToken } from "../store/auth";

const WS_URL = import.meta.env.VITE_WS_URL ?? "http://localhost:8000";
const NAMESPACE = "/ws";

let socket: Socket | null = null;

export const getSocket = (): Socket => {
  const token = authToken();
  if (!token) {
    throw new Error("Missing auth token for socket connection");
  }
  if (!socket) {
    socket = io(`${WS_URL}${NAMESPACE}`, {
      path: "/socket.io",
      auth: { token },
      autoConnect: true,
      reconnection: true,
    });
  } else {
    socket.auth = { token };
    if (!socket.connected) {
      socket.connect();
    }
  }
  return socket;
};

export const disconnectSocket = (): void => {
  socket?.disconnect();
  socket = null;
};
