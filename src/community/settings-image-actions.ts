import type { CommunityIdentity } from "./contracts.js";
import { discoverBlossomServers } from "./blossom-server-list.js";
import { uploadCommunityProfileImage } from "./profile-image-upload.js";

interface CommunitySettingsImageActionsDeps {
  runOperation(operation: string, action: () => Promise<void>): Promise<void>;
  ensureIdentity(operation: string): Promise<void>;
  getIdentity(): CommunityIdentity | undefined;
  getRelayUrl(): string;
  now(): number;
}

export function createCommunitySettingsImageActions(
  deps: CommunitySettingsImageActionsDeps,
) {
  return {
    uploadSettingsImage: (file: File, usage: "profile" | "emoji") =>
      uploadSettingsImage(deps, file, usage),
  };
}

async function uploadSettingsImage(
  deps: CommunitySettingsImageActionsDeps,
  file: File,
  usage: "profile" | "emoji",
): Promise<string> {
  const isProfile = usage === "profile";
  const operation = `settings:${isProfile ? "profile" : "emoji"}-image`;
  let uploadedUrl = "";
  await deps.runOperation(operation, async () => {
    await deps.ensureIdentity(operation);
    const identity = deps.getIdentity();
    if (identity === undefined)
      throw new Error("Connect an identity to continue");
    const relayUrl = deps.getRelayUrl();
    const serverUrls = await discoverBlossomServers(relayUrl, identity).catch(
      () => [],
    );
    uploadedUrl = await uploadCommunityProfileImage(file, {
      relayUrl,
      serverUrls,
      identity,
      content: `Upload Lapis ${isProfile ? "profile" : "custom emoji"} image`,
      purpose: isProfile ? "avatar" : "emoji",
      now: deps.now,
    });
  });
  return uploadedUrl;
}
