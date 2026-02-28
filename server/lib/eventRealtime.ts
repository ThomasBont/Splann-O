import { WebSocket } from "ws";

const eventRooms = new Map<number, Set<WebSocket>>();

export function registerEventSocket(eventId: number, ws: WebSocket) {
  const room = eventRooms.get(eventId) ?? new Set<WebSocket>();
  room.add(ws);
  eventRooms.set(eventId, room);
}

export function unregisterEventSocket(eventId: number, ws: WebSocket) {
  const room = eventRooms.get(eventId);
  if (!room) return;
  room.delete(ws);
  if (room.size === 0) eventRooms.delete(eventId);
}

export function broadcastEventRealtime(eventId: number, payload: object) {
  const room = eventRooms.get(eventId);
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
