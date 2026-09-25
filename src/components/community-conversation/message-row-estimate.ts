import type { Density } from "@lapismd/design-core/ai/chat";
import type { CommunityMessageModel } from "../community-workspace/model.js";

export interface CommunityMessageRowEstimateContext {
  density?: Density;
  continuation?: boolean;
  hasSupplement?: boolean;
}

const densityBase: Record<Density, number> = {
  compact: 86,
  balanced: 104,
  spacious: 132,
};

export function estimateCommunityMessageRow(
  message: Partial<CommunityMessageModel> | undefined,
  context: CommunityMessageRowEstimateContext = {},
): number {
  if (!message) return densityBase[context.density ?? "compact"];
  if (message.activity) return context.continuation ? 48 : 58;

  const density = context.density ?? "compact";
  const content = typeof message.content === "string" ? message.content : "";
  const hardLines = Math.max(1, content.split("\n").length);
  const softLines = Math.max(1, Math.ceil(content.length / lineWidth(density)));
  const codeBlocks = Math.floor((content.match(/```/gu)?.length ?? 0) / 2);
  const reactions = message.reactions?.length ? 34 : 0;
  const replies =
    message.replyCount || message.replyParticipantIds?.length ? 38 : 0;
  const supplement = context.hasSupplement ? 56 : 0;
  const continuationAdjustment = context.continuation ? -28 : 0;
  const markdownAdjustment = codeBlocks * 86 + Math.max(hardLines - 1, 0) * 10;

  return Math.max(
    52,
    densityBase[density] +
      continuationAdjustment +
      Math.max(softLines, hardLines) * 20 +
      markdownAdjustment +
      reactions +
      replies +
      supplement,
  );
}

function lineWidth(density: Density): number {
  if (density === "spacious") return 84;
  if (density === "balanced") return 92;
  return 104;
}
