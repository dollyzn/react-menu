import { io, Socket } from "socket.io-client";

let socket: Socket | null = null;

export const initializeSocket = (): Socket => {
  if (!socket) {
    socket = io(process.env.NEXT_PUBLIC_API_URL as string, {
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 5,
    });

    socket.on("connect", () => {
      console.log(`[Socket] Connected with id: ${socket?.id}`);
    });

    socket.on("disconnect", (reason) => {
      console.log(`[Socket] Disconnected: ${reason}`);
    });

    socket.on("reconnect_attempt", (attemptNumber) => {
      console.log(`[Socket] Reconnecting attempt: ${attemptNumber}`);
    });

    socket.on("reconnect", () => {
      console.log(`[Socket] Successfully reconnected`);
    });

    socket.on("reconnect_failed", () => {
      console.error("[Socket] Failed to reconnect after maximum attempts");
    });
  }
  return socket;
};
