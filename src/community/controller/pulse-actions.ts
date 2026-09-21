import type { NostrEvent, NostrEventTemplate } from "../../protocol/index.js";
import type { CommunityComposerSubmission } from "../composer-model.js";
import type {
  CommunityCommand,
  CommunityIdentity,
  CommunityOperationFailure,
  CommunityPulseFeedTab,
  CommunityPulseModel,
} from "../contracts.js";
import { contentMentionPubkeys } from "../content-mentions.js";
import {
  materializeCommunityPulse,
  pulseEventTargetId,
} from "../materialize-pulse.js";
import { eventDeleted } from "./event-deleted.js";

export interface PulsePublishContext {
  getPulse: () => CommunityPulseModel | undefined;
  setPulse: (next: CommunityPulseModel | undefined) => void;
  getPulseEvents: () => NostrEvent[];
  setPulseEvents: (events: NostrEvent[]) => void;
  getPulsePrimaryEventIds: () => string[];
  setPulsePrimaryEventIds: (ids: string[]) => void;
  getIdentityPubkey: () => string;
  getIdentity: () => CommunityIdentity | undefined;
  getRelayUrl: () => string;
  canDirectMessage: () => boolean;
  pulseAgents: () => CommunityPulseModel["agents"];
  now: () => number;
  ensureIdentity: (operation: string) => Promise<void>;
  throwOperationFailure: (
    operation: string,
    category: CommunityOperationFailure["category"],
    message: string,
  ) => never;
  execute: (operation: string, command: CommunityCommand) => Promise<void>;
  refreshPulse: (kind?: "notes" | "reactions") => Promise<void>;
}

export function rematerializePulse(
  ctx: PulsePublishContext,
  status: CommunityPulseModel["status"] = "ready",
  pulseError?: string,
): void {
  const selected = ctx.getPulse()?.tab;
  if (selected === undefined || selected === "search") return;
  ctx.setPulse({
    ...materializeCommunityPulse(ctx.getPulseEvents(), {
      tab: selected as CommunityPulseFeedTab,
      primaryEventIds: ctx.getPulsePrimaryEventIds(),
      ...(ctx.getIdentityPubkey() === ""
        ? {}
        : { identityPubkey: ctx.getIdentityPubkey() }),
      ...(ctx.pulseAgents() === undefined
        ? {}
        : { agents: ctx.pulseAgents()! }),
      asOf: ctx.now(),
      canDirectMessage: ctx.canDirectMessage(),
    }),
    status,
    ...(pulseError === undefined ? {} : { error: pulseError }),
  });
}

export async function publishPulse(
  ctx: PulsePublishContext,
  submission: CommunityComposerSubmission,
  replyToEventId?: string,
): Promise<void> {
  const content = submission.content.trim();
  const operation = `pulse:publish:${replyToEventId ?? "note"}`;
  if (content === "") {
    ctx.throwOperationFailure(
      operation,
      "validation",
      "Write a note before publishing",
    );
  }
  await ctx.ensureIdentity(operation);
  const parent =
    replyToEventId === undefined
      ? undefined
      : ctx
          .getPulseEvents()
          .find((event) => event.kind === 1 && event.id === replyToEventId);
  if (replyToEventId !== undefined && parent === undefined) {
    ctx.throwOperationFailure(
      operation,
      "validation",
      "The note being replied to is unavailable",
    );
  }
  const mentions = [
    ...new Set([
      ...submission.mentionPubkeys,
      ...contentMentionPubkeys(content),
      ...(parent === undefined ? [] : [parent.pubkey]),
    ]),
  ];
  const template: NostrEventTemplate = {
    kind: 1,
    created_at: ctx.now(),
    content,
    tags: [
      ...(parent === undefined
        ? []
        : [["e", parent.id, ctx.getRelayUrl(), "reply"]]),
      ...mentions.map((pubkey) => ["p", pubkey]),
      ...submission.attachments.map((media) => [
        "imeta",
        `url ${media.url}`,
        `m ${media.mimeType}`,
        `x ${media.sha256}`,
        `size ${media.size}`,
        ...(media.width === undefined || media.height === undefined
          ? []
          : [`dim ${media.width}x${media.height}`]),
        ...(media.alt === undefined ? [] : [`alt ${media.alt}`]),
      ]),
    ],
  };
  const signed = await ctx.getIdentity()!.signEvent(template);
  const previousEvents = ctx.getPulseEvents();
  const previousIds = ctx.getPulsePrimaryEventIds();
  ctx.setPulseEvents([...previousEvents, signed]);
  const tab = ctx.getPulse()?.tab;
  if (tab === "everyone" || tab === "mine") {
    ctx.setPulsePrimaryEventIds([
      signed.id,
      ...previousIds.filter((id) => id !== signed.id),
    ]);
  }
  rematerializePulse(ctx, "refreshing");
  try {
    await ctx.execute(operation, {
      type: "publish",
      template,
      optimisticEvent: signed,
    });
  } catch (cause) {
    ctx.setPulseEvents(previousEvents);
    ctx.setPulsePrimaryEventIds(previousIds);
    rematerializePulse(
      ctx,
      "error",
      cause instanceof Error
        ? cause.message
        : "The note could not be published",
    );
    throw cause;
  }
  await ctx.refreshPulse().catch(() => undefined);
}

export async function togglePulseLike(
  ctx: PulsePublishContext,
  eventId: string,
): Promise<void> {
  const operation = `pulse:like:${eventId}`;
  await ctx.ensureIdentity(operation);
  const pulseEvents = ctx.getPulseEvents();
  const target = pulseEvents.find(
    (event) => event.kind === 1 && event.id === eventId,
  );
  if (target === undefined) {
    ctx.throwOperationFailure(
      operation,
      "validation",
      "The note is unavailable",
    );
  }
  const identityPubkey = ctx.getIdentityPubkey();
  const previousReaction = pulseEvents.find(
    (event) =>
      event.kind === 7 &&
      event.pubkey === identityPubkey &&
      event.content === "+" &&
      pulseEventTargetId(event) === eventId &&
      !eventDeleted(pulseEvents, event.id),
  );
  const template: NostrEventTemplate =
    previousReaction === undefined
      ? {
          kind: 7,
          created_at: ctx.now(),
          content: "+",
          tags: [
            ["e", target.id],
            ["p", target.pubkey],
            ["k", "1"],
          ],
        }
      : {
          kind: 5,
          created_at: ctx.now(),
          content: "",
          tags: [
            ["e", previousReaction.id],
            ["k", "7"],
          ],
        };
  const signed = await ctx.getIdentity()!.signEvent(template);
  const previousEvents = pulseEvents;
  ctx.setPulseEvents([...pulseEvents, signed]);
  rematerializePulse(ctx, "refreshing");
  try {
    await ctx.execute(operation, {
      type: "publish",
      template,
      optimisticEvent: signed,
    });
  } catch (cause) {
    ctx.setPulseEvents(previousEvents);
    rematerializePulse(
      ctx,
      "error",
      cause instanceof Error
        ? cause.message
        : "The reaction could not be published",
    );
    throw cause;
  }
  await ctx.refreshPulse("reactions").catch(() => undefined);
}
