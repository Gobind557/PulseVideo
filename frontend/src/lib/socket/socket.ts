import { io, type Socket } from 'socket.io-client';

let socket: Socket | null = null;
let lastToken: string | null = null;

/**
 * One Socket.io client per tab; reconnect when access token rotates after refresh.
 * URL: same origin in dev (Vite proxies /socket.io), or VITE_WS_URL for explicit host.
 */
export function getVideoSocket(accessToken: string): Socket {
  const base =
    import.meta.env.VITE_WS_URL?.replace(/\/$/, '') ?? window.location.origin;

  if (socket?.connected && lastToken === accessToken) {
    return socket;
  }

  socket?.disconnect();
  lastToken = accessToken;

  socket = io(base, {
    path: '/socket.io',
    auth: { token: accessToken },
    transports: ['websocket', 'polling'],
    autoConnect: true,
  });

  return socket;
}

export function disconnectVideoSocket(): void {
  socket?.disconnect();
  socket = null;
  lastToken = null;
}
