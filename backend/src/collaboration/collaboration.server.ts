import * as WebSocket from 'ws';
import { IncomingMessage } from 'http';
import { verify } from 'jsonwebtoken';
import { Logger } from '@nestjs/common';

const logger = new Logger('CollaborationServer');

// Room → Set of clients
const rooms = new Map<string, Set<WebSocket>>();

function getRoom(name: string): Set<WebSocket> {
  if (!rooms.has(name)) rooms.set(name, new Set());
  return rooms.get(name)!;
}

function broadcast(room: Set<WebSocket>, data: Buffer | string, exclude?: WebSocket) {
  room.forEach((client) => {
    if (client !== exclude && client.readyState === WebSocket.OPEN) {
      client.send(data);
    }
  });
}

function onConnection(ws: WebSocket, req: IncomingMessage) {
  // Extract room name from URL: /collaboration/{blockId}?token=xxx
  const url = new URL(req.url ?? '/', `http://localhost`);
  const roomName = url.pathname.replace(/^\/collaboration\//, '').replace(/^\//, '');

  if (!roomName) {
    ws.close(1008, 'Room name required');
    return;
  }

  // Optional: authenticate via token param
  const token = url.searchParams.get('token');
  let userId = 'anonymous';
  if (token && process.env.JWT_SECRET) {
    try {
      const payload = verify(token, process.env.JWT_SECRET) as any;
      userId = payload.sub ?? 'anonymous';
    } catch {
      // Allow unauthenticated in dev; in prod you'd close here
    }
  }

  const room = getRoom(roomName);
  room.add(ws);

  logger.log(`Client ${userId} joined room "${roomName}" (${room.size} in room)`);

  // Send current awareness state to new client: all existing clients in room
  ws.on('message', (data: Buffer) => {
    // Relay raw Yjs messages to all peers in the same room
    broadcast(room, data, ws);
  });

  ws.on('close', () => {
    room.delete(ws);
    logger.log(`Client left room "${roomName}" (${room.size} remaining)`);
    if (room.size === 0) rooms.delete(roomName);
  });

  ws.on('error', (err) => {
    logger.error(`WebSocket error in room "${roomName}": ${err.message}`);
    room.delete(ws);
  });
}

export function startCollaborationServer(port = 3002) {
  const wss = new WebSocket.Server({ port });

  wss.on('connection', onConnection);

  wss.on('listening', () => {
    logger.log(`Collaboration WebSocket server listening on ws://localhost:${port}`);
  });

  wss.on('error', (err) => {
    logger.error(`Collaboration server error: ${err.message}`);
  });

  return wss;
}
