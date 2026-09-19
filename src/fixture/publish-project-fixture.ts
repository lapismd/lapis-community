import { finalizeEvent, getPublicKey } from "nostr-tools/pure";
import type { NostrEvent } from "../protocol/index.js";
import { createLocalProjectForgeFixture } from "./projects.js";
import { createCommitComment } from "../projects/commit-comments.js";
import { buildRepositoryAgentContexts } from "../projects/repository-agent-context.js";
import { localAgentRecords } from "./project-agent-records.js";
export async function publishProjectFixture(
  options: {
    operatorSecret: Uint8Array;
    contributorSecret: Uint8Array;
    agentSecret: Uint8Array;
    channelId: string;
    relatedChannelId: string;
    relayUrl: string;
    createdAt: number;
  },
  publish: (event: NostrEvent, secret: Uint8Array) => Promise<unknown>,
) {
  const {
    operatorSecret,
    contributorSecret,
    agentSecret,
    channelId,
    createdAt,
  } = options;
  const owner = getPublicKey(operatorSecret),
    agent = getPublicKey(agentSecret);
  const records = localAgentRecords(createdAt);
  const request = finalizeEvent(
    {
      kind: 9,
      created_at: createdAt + 10,
      tags: [["h", channelId]],
      content: records[0]!.text!,
    },
    operatorSecret,
  );
  const response = finalizeEvent(
    {
      kind: 9,
      created_at: createdAt + 11,
      tags: [
        ["h", channelId],
        ["e", request.id, "", "root"],
        ["e", request.id, "", "reply"],
      ],
      content: records.at(-1)!.text!,
    },
    agentSecret,
  );
  await publish(request, operatorSecret);
  await publish(response, agentSecret);
  const fixture = createLocalProjectForgeFixture({
    channelId,
    relatedChannelId: options.relatedChannelId,
    relayUrl: options.relayUrl,
    createdAt,
    ownerPubkey: owner,
    contributorPubkey: getPublicKey(contributorSecret),
    agentPubkey: agent,
    sourceMessages: { request: request.id, response: response.id, owner },
  });
  const projectEvents: NostrEvent[] = [];
  for (const publication of fixture.publications) {
    const secret =
      publication.signer === "owner"
        ? operatorSecret
        : publication.signer === "contributor"
          ? contributorSecret
          : agentSecret;
    const event = finalizeEvent(publication.template, secret);
    await publish(event, secret);
    projectEvents.push(event);
  }
  const manifest = finalizeEvent(
    fixture.agentContext.checkpointManifest(
      fixture.agentContext.pagePublicationIndices.map(
        (index) => projectEvents[index]!.id,
      ),
    ).template,
    agentSecret,
  );
  await publish(manifest, agentSecret);
  const events = [...projectEvents, manifest, request, response];
  const checkpoint = buildRepositoryAgentContexts(events)[0]!;
  for (const template of [
    createCommitComment(
      checkpoint,
      checkpoint.commitIds[0]!,
      request.id,
      "Please keep the README review instructions next to the agent checkpoint.",
    ),
    {
      kind: 7,
      content: "👍",
      tags: [
        ["h", channelId],
        ["e", response.id],
        ["p", agent],
        ["k", "9"],
      ],
    },
  ]) {
    const event = finalizeEvent(
      { ...template, created_at: createdAt + 12 },
      operatorSecret,
    );
    await publish(event, operatorSecret);
    events.push(event);
  }
  return events;
}
