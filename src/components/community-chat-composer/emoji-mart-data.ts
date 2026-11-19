/** Load @emoji-mart/data for Node acceptance and browser builds. */
export async function loadEmojiMartData(): Promise<unknown> {
  try {
    const { default: data } = await import("@emoji-mart/data", {
      with: { type: "json" },
    });
    return data;
  } catch (error) {
    if (!import.meta.url.startsWith("file:")) throw error;
    const { createRequire } = await import("node:module");
    return createRequire(import.meta.url)("@emoji-mart/data");
  }
}
