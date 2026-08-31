import { verifyEvent } from "nostr-tools/pure";

import {
  parseNip98AuthorizationHeader,
  verifyHttpAuth,
} from "@lapismd/registry-auth";
import {
  createSnapshotContent,
  createSnapshotEventTemplate,
  materializeRegistry,
  nostrEventSchema,
  projectV1,
  verifySnapshot,
} from "@lapismd/registry-protocol";
import type {
  MaterializedRegistry,
  NostrEvent,
} from "@lapismd/registry-protocol";

import { newChallenge } from "./challenges.js";
import type { AuthChallengeStore } from "./challenges.js";
import type { RegistryServiceConfig } from "./config.js";
import type { RegistryEventStore } from "./event-store.js";

export interface RegistryServiceDependencies {
  config: RegistryServiceConfig;
  events: RegistryEventStore;
  challenges: AuthChallengeStore;
  now?: (() => Date) | undefined;
}

function json(
  value: unknown,
  status = 200,
  headers: HeadersInit = {},
): Response {
  return Response.json(value, {
    status,
    headers: { "cache-control": "no-store", ...headers },
  });
}

function error(status: number, code: string, message: string): Response {
  return json({ error: { code, message } }, status);
}

function oneTag(event: NostrEvent, name: string): string | undefined {
  const values = event.tags.filter((tag) => tag[0] === name);
  return values.length === 1 ? values[0]?.[1] : undefined;
}

async function state(
  events: RegistryEventStore,
  config: RegistryServiceConfig,
): Promise<MaterializedRegistry> {
  const stored = await events.list();
  return materializeRegistry(
    stored.map((value) => value.event),
    config.kinds,
    config.authorities,
  );
}

async function authenticateSubmission(
  request: Request,
  rawBody: string,
  submitted: NostrEvent,
  dependencies: RegistryServiceDependencies,
  now: Date,
): Promise<Response | undefined> {
  if (!dependencies.config.requireHttpAuth) return undefined;
  const header = request.headers.get("authorization");
  if (header === null)
    return error(401, "auth-required", "NIP-98 authorization is required");

  try {
    const authEvent = parseNip98AuthorizationHeader(header);
    const challenge = oneTag(authEvent, "challenge");
    if (challenge === undefined) {
      return error(401, "challenge-missing", "A one-use challenge is required");
    }
    const signer = verifyHttpAuth(authEvent, {
      url: request.url,
      method: request.method,
      body: rawBody,
      challenge,
      now: Math.floor(now.getTime() / 1_000),
    });
    if (signer !== submitted.pubkey) {
      return error(
        403,
        "author-mismatch",
        "HTTP authorization signer must match the submitted event author",
      );
    }
    const consumed = await dependencies.challenges.consume(
      challenge,
      request.url,
      request.method,
      now.toISOString(),
    );
    if (!consumed) {
      return error(
        401,
        "challenge-invalid",
        "Challenge is expired, reused, or mismatched",
      );
    }
  } catch (cause) {
    return error(
      401,
      "auth-invalid",
      cause instanceof Error ? cause.message : "Authorization failed",
    );
  }
  return undefined;
}

function recognizedKinds(config: RegistryServiceConfig): ReadonlySet<number> {
  return new Set(Object.values(config.kinds));
}

function workflowKinds(config: RegistryServiceConfig): ReadonlySet<number> {
  return new Set([
    config.kinds.softwareApplication,
    config.kinds.releaseArtifactSet,
    config.kinds.assessmentLabel,
    config.kinds.approval,
    config.kinds.revocation,
    config.kinds.moderationReport,
  ]);
}

export async function handleRegistryRequest(
  request: Request,
  dependencies: RegistryServiceDependencies,
): Promise<Response> {
  const now = dependencies.now?.() ?? new Date();
  const url = new URL(request.url);

  if (request.method === "GET" && url.pathname === "/health") {
    return json({ status: "ok" });
  }

  if (request.method === "GET" && url.pathname === "/auth/challenge") {
    const actionUrl = new URL(
      "events",
      dependencies.config.publicBaseUrl,
    ).toString();
    const challenge = newChallenge(actionUrl, "POST", now);
    await dependencies.challenges.create(challenge);
    return json({
      challenge: challenge.token,
      action: { url: challenge.actionUrl, method: challenge.method },
      expiresAt: challenge.expiresAt,
    });
  }

  if (request.method === "POST" && url.pathname === "/events") {
    const rawBody = await request.text();
    let body: unknown;
    try {
      body = JSON.parse(rawBody) as unknown;
    } catch {
      return error(400, "json-invalid", "Request body must be JSON");
    }
    const eventCandidate =
      body !== null && typeof body === "object" && "event" in body
        ? (body as { event: unknown }).event
        : undefined;
    const parsed = nostrEventSchema.safeParse(eventCandidate);
    if (!parsed.success || !verifyEvent(parsed.data)) {
      return error(
        422,
        "event-invalid",
        "Nostr event id or signature is invalid",
      );
    }
    const event = parsed.data;
    const authFailure = await authenticateSubmission(
      request,
      rawBody,
      event,
      dependencies,
      now,
    );
    if (authFailure !== undefined) return authFailure;

    if (!recognizedKinds(dependencies.config).has(event.kind)) {
      return error(
        422,
        "kind-unsupported",
        "Event kind is outside the registry protocol",
      );
    }

    if (event.kind === dependencies.config.kinds.snapshot) {
      const current = await state(dependencies.events, dependencies.config);
      if (
        !verifySnapshot(
          event,
          current,
          dependencies.config.kinds,
          dependencies.config.authorities,
        )
      ) {
        return error(
          422,
          "snapshot-invalid",
          "Snapshot does not match current registry state",
        );
      }
    } else if (workflowKinds(dependencies.config).has(event.kind)) {
      const probe = materializeRegistry(
        [event],
        dependencies.config.kinds,
        dependencies.config.authorities,
      );
      const eventIssue = probe.issues.find(
        (issue) => issue.eventId === event.id,
      );
      if (eventIssue !== undefined) {
        return error(422, `event-${eventIssue.code}`, eventIssue.message);
      }
    }

    const inserted = await dependencies.events.put({
      event,
      source: "api",
      receivedAt: now.toISOString(),
    });
    return json({ eventId: event.id, inserted }, inserted ? 201 : 200);
  }

  if (request.method === "GET" && url.pathname.startsWith("/events/")) {
    const eventId = url.pathname.slice("/events/".length);
    const stored = await dependencies.events.get(eventId);
    return stored === undefined
      ? error(404, "event-not-found", "Event was not found")
      : json(stored);
  }

  if (
    request.method === "GET" &&
    (url.pathname === "/preview/v1/index.json" ||
      url.pathname === "/preview/v1/provenance.json" ||
      url.pathname.startsWith("/preview/v1/plugins/"))
  ) {
    const registry = await state(dependencies.events, dependencies.config);
    const projection = projectV1(registry, {
      generatedAt: now.toISOString(),
      indexBase: dependencies.config.indexBase,
    });
    const headers = {
      "x-lapis-registry-root": registry.root,
      "x-lapis-registry-unsigned": "true",
    };
    if (url.pathname === "/preview/v1/index.json") {
      return json(projection.index, 200, headers);
    }
    if (url.pathname === "/preview/v1/provenance.json") {
      const stored = await dependencies.events.list();
      return json(
        {
          ...projection.provenance,
          issues: registry.issues,
          sourceCounts: stored.reduce<Record<string, number>>(
            (counts, value) => {
              counts[value.source] = (counts[value.source] ?? 0) + 1;
              return counts;
            },
            {},
          ),
        },
        200,
        headers,
      );
    }
    const pluginId = url.pathname
      .slice("/preview/v1/plugins/".length)
      .replace(/\.json$/u, "");
    const detail = projection.plugins.get(pluginId);
    return detail === undefined
      ? error(404, "plugin-not-found", "Plugin was not found")
      : json(detail, 200, headers);
  }

  if (
    request.method === "GET" &&
    url.pathname === "/preview/snapshot-template"
  ) {
    const registry = await state(dependencies.events, dependencies.config);
    const createdAt = Math.floor(now.getTime() / 1_000);
    const content = createSnapshotContent(registry, now.toISOString());
    return json({
      root: registry.root,
      template: createSnapshotEventTemplate(
        content,
        dependencies.config.kinds,
        createdAt,
      ),
    });
  }

  return error(404, "not-found", "Route was not found");
}
