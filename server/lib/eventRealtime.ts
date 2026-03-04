import { WebSocket } from "ws";

const planRooms = new Map<string, Set<WebSocket>>();

function roomKey(planId: number): string {
  return `plan:${planId}`;
}

export function registerEventSocket(eventId: number, ws: WebSocket) {
  const key = roomKey(eventId);
  const room = planRooms.get(key) ?? new Set<WebSocket>();
  room.add(ws);
  planRooms.set(key, room);
}

export function unregisterEventSocket(eventId: number, ws: WebSocket) {
  const key = roomKey(eventId);
  const room = planRooms.get(key);
  if (!room) return;
  room.delete(ws);
  if (room.size === 0) planRooms.delete(key);
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
  room.forEach((ws) => {
    if (ws.readyState !== WebSocket.OPEN) return;
    try {
      ws.send(serialized);
    } catch {
      // Ignore per-socket send failures to prevent room-wide broadcast crashes.
    }
  });
}
