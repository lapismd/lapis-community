import type { CommunityIdentity } from "./contracts.js";
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
  const upload = (operation: string, content: string, file: File) =>
    uploadSettingsImage(deps, operation, content, file);
  return {
    uploadSettingsImage: (file: File, usage: "profile" | "emoji") =>
      usage === "profile"
        ? upload("settings:profile-image", "Upload Lapis profile image", file)
        : upload(
            "settings:emoji-image",
            "Upload Lapis custom emoji image",
            file,
          ),
  };
}

async function uploadSettingsImage(
  deps: CommunitySettingsImageActionsDeps,
  operation: string,
  content: string,
  file: File,
): Promise<string> {
  let uploadedUrl = "";
  await deps.runOperation(operation, async () => {
    await deps.ensureIdentity(operation);
    const identity = deps.getIdentity();
    if (identity === undefined)
      throw new Error("Connect an identity to continue");
    uploadedUrl = await uploadCommunityProfileImage(file, {
      relayUrl: deps.getRelayUrl(),
      identity,
      content,
      now: deps.now,
    });
  });
  return uploadedUrl;
}
