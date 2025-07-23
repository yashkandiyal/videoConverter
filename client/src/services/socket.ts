import { io, Socket } from "socket.io-client";

class SocketService {
  private socket: Socket | null = null;
  private apiBase = "";

  init(apiBase: string, token: string) {
    // If we already have a socket with the same base + token, reuse it
    if (this.socket && this.apiBase === apiBase) {
      return this.socket;
    }

    // Otherwise create a fresh connection
    this.apiBase = apiBase;
    if (this.socket) this.socket.disconnect();

    this.socket = io(apiBase, {
      path: "/ws", // must match backend initQueueEvents()
      auth: { token },
      transports: ["websocket"],
    });

    return this.socket;
  }

  get() {
    if (!this.socket)
      throw new Error("Socket not initialised – call init() first");
    return this.socket;
  }

  disconnect() {
    this.socket?.disconnect();
    this.socket = null;
  }
}

export const socketService = new SocketService();
