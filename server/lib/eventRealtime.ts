import { WebSocket } from "ws";

const planRooms = new Map<string, Set<WebSocket>>();
const socketRooms = new WeakMap<WebSocket, Set<string>>();

function roomKey(planId: number): string {
  return `plan:${planId}`;
}

export function registerEventSocket(eventId: number, ws: WebSocket) {
  const key = roomKey(eventId);
  const room = planRooms.get(key) ?? new Set<WebSocket>();
  room.add(ws);
  planRooms.set(key, room);

  const memberships = socketRooms.get(ws) ?? new Set<string>();
  memberships.add(key);
  socketRooms.set(ws, memberships);
}

export function unregisterEventSocket(eventId: number, ws: WebSocket) {
  const key = roomKey(eventId);
  const room = planRooms.get(key);
  if (!room) return;
  room.delete(ws);
  if (room.size === 0) planRooms.delete(key);

  const memberships = socketRooms.get(ws);
  if (!memberships) return;
  memberships.delete(key);
  if (memberships.size === 0) {
    socketRooms.delete(ws);
  }
}

export function unregisterSocketEverywhere(ws: WebSocket) {
  const memberships = socketRooms.get(ws);
  if (!memberships) return;
  for (const key of Array.from(memberships)) {
    const room = planRooms.get(key);
    if (!room) continue;
    room.delete(ws);
    if (room.size === 0) planRooms.delete(key);
  }
  socketRooms.delete(ws);
}

export function broadcastEventRealtime(eventId: number, payload: object) {
  const room = planRooms.get(roomKey(eventId));
  if (!room) return;
  let serialized = "";
  try {
    serialized = JSON.stringify(payload, (_key, value) => (typeof value === "bigint" ? value.toString() : value));
  } catch {
    return;
  }
  const staleSockets: WebSocket[] = [];
  room.forEach((ws) => {
    if (ws.readyState !== WebSocket.OPEN) {
      staleSockets.push(ws);
      return;
    }
    try {
      ws.send(serialized);
    } catch {
      staleSockets.push(ws);
    }
  });
  for (const ws of staleSockets) {
    unregisterSocketEverywhere(ws);
    try {
      ws.terminate();
    } catch {
      // Ignore forced-close failures during stale socket cleanup.
    }
  }
}
