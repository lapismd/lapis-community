import { agentContextMessageRole } from "../projects/repository-agent-context.js";
import { finalizeEvent, getPublicKey } from "nostr-tools/pure";
import type { NostrEventTemplate } from "../protocol/index.js";
import {
  repositoryContextEvents,
  contextFixture as f,
} from "./repository-context-fixture.js";
import { buildRepositoryAgentContexts } from "../projects/repository-agent-context.js";
const ownerSecret = new Uint8Array(32).fill(3),
  agentSecret = new Uint8Array(32).fill(4);
export const owner = getPublicKey(ownerSecret),
  agent = getPublicKey(agentSecret);
export const signOwner = (template: NostrEventTemplate) =>
  finalizeEvent(template, ownerSecret);
export const request = signOwner({
  kind: 9,
  created_at: 1700000000,
  tags: [["h", "room"]],
  content: "Update README",
});
export const response = finalizeEvent(
  {
    kind: 9,
    created_at: 1700000002,
    tags: [
      ["h", "room"],
      ["e", request.id, "", "root"],
      ["e", request.id, "", "reply"],
      ["d", "message"],
    ],
    content: "Updated README and verified the diff.",
  },
  agentSecret,
);
const original = repositoryContextEvents();
const pages = original
  .filter((event) => event.kind === 3908)
  .map((event) => {
    const body = JSON.parse(event.content),
      record = body.records[0];
    if (record.sequence > 0) record.sequence++;
    if (agentContextMessageRole(record) === "user")
      Object.assign(record, {
        source_event_id: request.id,
        author_pubkey: owner,
      });
    if (record.kind === "assistant_message")
      Object.assign(record, {
        source_event_id: response.id,
        author_pubkey: agent,
        text: response.content,
      });
    return finalizeEvent(
      { ...event, content: JSON.stringify(body) },
      agentSecret,
    );
  });
const originalManifest = original.find((event) => event.kind === 3907)!;
pages.push(
  finalizeEvent(
    {
      ...pages[0]!,
      content: JSON.stringify({
        ...JSON.parse(pages[0]!.content),
        records: [
          {
            id: "thinking",
            sequence: 1,
            kind: "thinking",
            text: "Inspecting the README before editing.",
            created_at_ms: 1700000000500,
          },
        ],
      }),
    },
    agentSecret,
  ),
);
const body = JSON.parse(originalManifest.content);
body.record_count = pages.length;
pages.sort(
  (a, b) =>
    JSON.parse(a.content).records[0].sequence -
    JSON.parse(b.content).records[0].sequence,
);
body.page_event_ids = pages.map((page) => page.id);
body.actor.pubkey = agent;
const manifest = finalizeEvent(
  { ...originalManifest, content: JSON.stringify(body) },
  agentSecret,
);
export const events = [request, response, ...pages, manifest];
export const checkpoint = buildRepositoryAgentContexts(events)[0]!;
export const message = {
  id: "message",
  type: "message" as const,
  role: "assistant" as const,
  text: response.content,
  authorPubkey: agent,
  sourceEventId: response.id,
  createdAt: new Date(response.created_at * 1000).toISOString(),
};
export const commit = f.commit;
