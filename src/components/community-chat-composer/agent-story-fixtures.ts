export const communityComposerStoryOwner = "1".repeat(64);
export const communityComposerStoryFizz = "a".repeat(64);
export const communityComposerStoryHoney = "b".repeat(64);

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
