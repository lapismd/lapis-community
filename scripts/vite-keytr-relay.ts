import fs from "node:fs";
import path from "node:path";

import type { Plugin } from "vite";
import { WebSocketServer } from "ws";

import { validateCommunityKeytrEvent } from "../src/auth/index.js";
import type { NostrEvent } from "../src/protocol/index.js";

const KEYTR_EVENT_KIND = 31_777;
const MAX_EVENTS = 256;
const MAX_CONTENT_LENGTH = 4_096;

export function keytrDevelopmentRelay(options: {
  storagePath: string;
  pathname?: string;
}): Plugin {
  const pathname = options.pathname ?? "/keytr-relay";
  return {
    name: "lapis-community-keytr-development-relay",
    configureServer(server) {
      const httpServer = server.httpServer;
      if (httpServer === null) return;
      const events = readEvents(options.storagePath);
      const sockets = new WebSocketServer({ noServer: true });
      sockets.on("connection", (socket) => {
        socket.on("message", (data) => {
          let message: unknown;
          try {
            message = JSON.parse(data.toString());
          } catch {
            return;
          }
          if (!Array.isArray(message)) return;
          if (message[0] === "EVENT") {
            const candidate = message[1];
            if (!isKeytrEvent(candidate)) {
              const eventId =
                typeof candidate === "object" &&
                candidate !== null &&
                "id" in candidate &&
                typeof candidate.id === "string"
                  ? candidate.id
                  : "";
              socket.send(
                JSON.stringify([
                  "OK",
                  eventId,
                  false,
                  "invalid: only valid Keytr records are accepted",
                ]),
              );
              return;
            }
            const event = candidate;
            const coordinate = eventCoordinate(event);
            const existing = events.get(coordinate);
            if (
              existing === undefined ||
              event.created_at > existing.created_at ||
              (event.created_at === existing.created_at &&
                event.id > existing.id)
            ) {
              events.set(coordinate, event);
              trimEvents(events);
              writeEvents(options.storagePath, events);
            }
            socket.send(JSON.stringify(["OK", event.id, true, ""]));
            return;
          }
          if (message[0] !== "REQ" || typeof message[1] !== "string") return;
          const subscriptionId = message[1];
          const filters = message
            .slice(2)
            .filter(
              (value): value is Record<string, unknown> =>
                typeof value === "object" && value !== null,
            );
          for (const event of events.values()) {
            if (filters.some((filter) => matchesFilter(event, filter))) {
              socket.send(JSON.stringify(["EVENT", subscriptionId, event]));
            }
          }
          socket.send(JSON.stringify(["EOSE", subscriptionId]));
        });
      });
      httpServer.on("upgrade", (request, socket, head) => {
        const requestPath = new URL(
          request.url ?? "/",
          "http://community.localhost",
        ).pathname;
        if (requestPath !== pathname) return;
        sockets.handleUpgrade(request, socket, head, (client) => {
          sockets.emit("connection", client, request);
        });
      });
      httpServer.once("close", () => {
        for (const client of sockets.clients) client.terminate();
        sockets.close();
      });
    },
  };
}

function readEvents(storagePath: string): Map<string, NostrEvent> {
  try {
    const values = JSON.parse(fs.readFileSync(storagePath, "utf8"));
    if (!Array.isArray(values)) return new Map();
    return new Map(
      values
        .filter((value): value is NostrEvent => isKeytrEvent(value))
        .map((event) => [eventCoordinate(event), event]),
    );
  } catch {
    return new Map();
  }
}

function writeEvents(
  storagePath: string,
  events: ReadonlyMap<string, NostrEvent>,
): void {
  fs.mkdirSync(path.dirname(storagePath), { recursive: true });
  const temporaryPath = `${storagePath}.tmp`;
  fs.writeFileSync(temporaryPath, JSON.stringify([...events.values()]));
  fs.renameSync(temporaryPath, storagePath);
}

function trimEvents(events: Map<string, NostrEvent>): void {
  if (events.size <= MAX_EVENTS) return;
  const retained = [...events.entries()]
    .toSorted((left, right) => right[1].created_at - left[1].created_at)
    .slice(0, MAX_EVENTS);
  events.clear();
  for (const [coordinate, event] of retained) events.set(coordinate, event);
}

function isKeytrEvent(value: unknown): value is NostrEvent {
  if (typeof value !== "object" || value === null) return false;
  const event = value as NostrEvent;
  if (
    event.kind !== KEYTR_EVENT_KIND ||
    typeof event.content !== "string" ||
    event.content.length > MAX_CONTENT_LENGTH ||
    !Array.isArray(event.tags) ||
    !event.tags.every(
      (tag) =>
        Array.isArray(tag) && tag.every((part) => typeof part === "string"),
    )
  ) {
    return false;
  }
  const rpTags = event.tags.filter((tag) => tag[0] === "rp");
  if (rpTags.length !== 1 || !rpTags[0]?.[1]) return false;
  try {
    validateCommunityKeytrEvent(event, { rpId: rpTags[0][1] });
    return true;
  } catch {
    return false;
  }
}

function eventCoordinate(event: NostrEvent): string {
  return `${event.pubkey}:${event.tags.find((tag) => tag[0] === "d")?.[1] ?? ""}`;
}

function matchesFilter(
  event: NostrEvent,
  filter: Record<string, unknown>,
): boolean {
  if (Array.isArray(filter.authors) && !filter.authors.includes(event.pubkey)) {
    return false;
  }
  if (Array.isArray(filter.kinds) && !filter.kinds.includes(event.kind)) {
    return false;
  }
  const dValues = filter["#d"];
  return (
    !Array.isArray(dValues) ||
    event.tags.some((tag) => tag[0] === "d" && dValues.includes(tag[1]))
  );
}
