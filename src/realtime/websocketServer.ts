import type { IncomingMessage, Server } from "node:http";
import { WebSocket, WebSocketServer } from "ws";
import { basePrisma } from "../config/prisma";
import { config } from "../config/unifiedConfig";
import { logger } from "../observability/logger";
import { consumeRealtimeTicket, subscribeRealtimeUser } from "./realtimeHub";

type AliveWebSocket = WebSocket & { isAlive?: boolean };

export function attachRealtimeServer(server: Server) {
  const websocketServer = new WebSocketServer({ noServer: true });
  let activeConnections = 0;
  let reconnects = 0;
  const seenSessions = new Set<string>();

  server.on("upgrade", async (request, socket, head) => {
    try {
      const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);
      if (url.pathname !== "/api/realtime" || !config.realtime.enabled) {
        socket.destroy();
        return;
      }
      const rawTicket = url.searchParams.get("ticket");
      if (!rawTicket) {
        socket.destroy();
        return;
      }
      const ticket = await consumeRealtimeTicket(rawTicket);
      if (!ticket) {
        socket.destroy();
        return;
      }
      const session = await basePrisma.authSession.findFirst({
        where: {
          id: ticket.sessionId,
          userId: ticket.userId,
          tenantId: ticket.tenantId,
          revokedAt: null,
          expiresAt: { gt: new Date() },
          user: { isActive: true, deletedAt: null, tenantId: ticket.tenantId },
        },
        select: { id: true },
      });
      if (!session) {
        socket.destroy();
        return;
      }
      websocketServer.handleUpgrade(request, socket, head, (websocket) => {
        websocketServer.emit("connection", websocket, request, ticket);
      });
    } catch {
      socket.destroy();
    }
  });

  websocketServer.on("connection", (websocket: AliveWebSocket, _request: IncomingMessage, identity: { userId: string; tenantId: string; sessionId: string }) => {
    activeConnections += 1;
    if (seenSessions.has(identity.sessionId)) reconnects += 1;
    seenSessions.add(identity.sessionId);
    logger.info("realtime_connection_opened", {
      category: "observability",
      component: "websocket",
      outcome: "connected",
      connections: activeConnections,
      reconnects,
    });
    websocket.isAlive = true;
    const unsubscribe = subscribeRealtimeUser(identity.userId, (envelope) => {
      if (websocket.readyState === WebSocket.OPEN && envelope.tenantId === identity.tenantId) {
        websocket.send(JSON.stringify(envelope));
      }
    });
    websocket.on("pong", () => { websocket.isAlive = true; });
    websocket.on("close", () => {
      unsubscribe();
      activeConnections = Math.max(0, activeConnections - 1);
      logger.info("realtime_connection_closed", { category: "observability", component: "websocket", outcome: "closed", connections: activeConnections });
    });
    websocket.on("error", unsubscribe);
    websocket.send(JSON.stringify({ version: 1, type: "realtime.ready", occurredAt: new Date().toISOString() }));
  });

  const heartbeat = setInterval(() => {
    websocketServer.clients.forEach((client: AliveWebSocket) => {
      if (client.isAlive === false) {
        client.terminate();
        return;
      }
      client.isAlive = false;
      client.ping();
    });
  }, 25_000);
  heartbeat.unref();

  websocketServer.on("close", () => clearInterval(heartbeat));
  logger.info("realtime_websocket_ready", { category: "observability", component: "websocket", outcome: "ready" });
  return websocketServer;
}
