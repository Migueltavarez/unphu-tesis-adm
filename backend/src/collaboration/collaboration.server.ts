import * as WebSocket from 'ws';
import { IncomingMessage } from 'http';
import { verify } from 'jsonwebtoken';
import { Logger } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { assertThesisAccess } from '../common/access/thesis-access.util';

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

/**
 * Resuelve la sala (blockId) hasta el trabajo de grado y verifica que el
 * usuario tenga acceso (dueño, asesor o staff). Devuelve true si puede entrar.
 */
async function canAccessRoom(
  prisma: PrismaService,
  roomName: string,
  userId: string,
  userRole: UserRole,
): Promise<boolean> {
  const block = await prisma.block.findUnique({
    where: { id: roomName },
    select: {
      node: {
        select: {
          document: {
            select: {
              thesisWork: {
                select: {
                  student: { select: { userId: true } },
                  advisor: { select: { userId: true } },
                },
              },
            },
          },
        },
      },
    },
  });
  const thesisWork = block?.node?.document?.thesisWork;
  if (!thesisWork) return false; // sala desconocida → fail-closed
  try {
    assertThesisAccess(thesisWork, userId, userRole);
    return true;
  } catch {
    return false;
  }
}

function onConnection(prisma: PrismaService, jwtSecret: string) {
  return (ws: WebSocket, req: IncomingMessage) => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    const roomName = url.pathname.replace(/^\/collaboration\//, '').replace(/^\//, '');

    if (!roomName) {
      ws.close(1008, 'Room name required');
      return;
    }

    // Autenticación OBLIGATORIA: sin token válido no se entra.
    const token = url.searchParams.get('token');
    if (!token || !jwtSecret) {
      ws.close(1008, 'Authentication required');
      return;
    }

    let userId: string;
    let userRole: UserRole;
    try {
      const payload = verify(token, jwtSecret) as { sub: string; role: UserRole };
      userId = payload.sub;
      userRole = payload.role;
    } catch {
      ws.close(1008, 'Invalid token');
      return;
    }

    // Buffer de mensajes que lleguen mientras se valida la pertenencia (async).
    const pending: Buffer[] = [];
    let joined = false;
    ws.on('message', (data: Buffer) => {
      if (joined) {
        const room = getRoom(roomName);
        broadcast(room, data, ws);
      } else {
        pending.push(data);
      }
    });

    canAccessRoom(prisma, roomName, userId, userRole)
      .then((allowed) => {
        if (!allowed) {
          ws.close(1008, 'Forbidden');
          return;
        }
        if (ws.readyState !== WebSocket.OPEN) return;

        const room = getRoom(roomName);
        room.add(ws);
        joined = true;
        logger.log(`Client ${userId} joined room "${roomName}" (${room.size} in room)`);

        // Vaciar los mensajes que llegaron durante la validación.
        for (const data of pending) broadcast(room, data, ws);
        pending.length = 0;

        ws.on('close', () => {
          room.delete(ws);
          logger.log(`Client left room "${roomName}" (${room.size} remaining)`);
          if (room.size === 0) rooms.delete(roomName);
        });
      })
      .catch((err) => {
        logger.error(`Room access check failed for "${roomName}": ${err.message}`);
        ws.close(1011, 'Internal error');
      });

    ws.on('error', (err) => {
      logger.error(`WebSocket error in room "${roomName}": ${err.message}`);
      getRoom(roomName).delete(ws);
    });
  };
}

export function startCollaborationServer(port = 3002, prisma: PrismaService, jwtSecret: string) {
  const wss = new WebSocket.Server({ port });

  wss.on('connection', onConnection(prisma, jwtSecret));

  wss.on('listening', () => {
    logger.log(`Collaboration WebSocket server listening on ws://localhost:${port}`);
  });

  wss.on('error', (err) => {
    logger.error(`Collaboration server error: ${err.message}`);
  });

  return wss;
}
