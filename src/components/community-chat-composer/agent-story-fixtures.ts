export const communityComposerStoryOwner = "1".repeat(64);
export const communityComposerStoryFizz = "a".repeat(64);
export const communityComposerStoryHoney = "b".repeat(64);

export function composerMentionLockButton(canvas: {
  getByRole: (role: "button", options: { name: string }) => HTMLElement;
}): HTMLButtonElement | null {
  const host = canvas
    .getByRole("button", { name: "Mention someone" })
    .closest("[data-ui-component='community-composer-mention-button']");
  return host?.querySelector("[data-ui-part='composer-mention-lock']") ?? null;
}

export const communityComposerStoryAgents = [
  {
    pubkey: communityComposerStoryFizz,
    name: "Fizz",
    ownerPubkey: communityComposerStoryOwner,
    channelIds: ["general"],
  },
  {
    pubkey: communityComposerStoryHoney,
    name: "BHoney",
    ownerPubkey: communityComposerStoryOwner,
    channelIds: [],
  },
];
