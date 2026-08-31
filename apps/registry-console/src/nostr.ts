import { eventBody, loadChallenge, submitEvent } from "./api.js";
import type { Nip07Provider, NostrEvent, NostrEventTemplate } from "./types.js";

function exactTemplate(
  requested: NostrEventTemplate,
  signed: NostrEvent,
): boolean {
  return (
    signed.kind === requested.kind &&
    signed.created_at === requested.created_at &&
    signed.content === requested.content &&
    JSON.stringify(signed.tags) === JSON.stringify(requested.tags)
  );
}

export function requireNip07(): Nip07Provider {
  if (window.nostr === undefined) {
    throw new Error("No NIP-07 signer extension is available in this browser");
  }
  return window.nostr;
}

export async function signExactTemplate(
  provider: Nip07Provider,
  template: NostrEventTemplate,
): Promise<NostrEvent> {
  const signed = await provider.signEvent(template);
  if (!exactTemplate(template, signed)) {
    throw new Error("Signer changed the requested event template");
  }
  return signed;
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

function base64Utf8(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

export async function submitWithNip98(
  apiBase: string,
  provider: Nip07Provider,
  event: NostrEvent,
): Promise<{ eventId: string; inserted: boolean }> {
  const signerPubkey = await provider.getPublicKey();
  if (signerPubkey !== event.pubkey) {
    throw new Error(
      "Connected signer does not match the submitted event author",
    );
  }
  const body = eventBody(event);
  const challenge = await loadChallenge(apiBase);
  const auth = await signExactTemplate(provider, {
    kind: 27235,
    created_at: Math.floor(Date.now() / 1_000),
    tags: [
      ["u", new URL(challenge.action.url).toString()],
      ["method", challenge.action.method.toUpperCase()],
      ["payload", await sha256Hex(body)],
      ["challenge", challenge.challenge],
    ],
    content: "",
  });
  return submitEvent(
    challenge.action,
    body,
    `Nostr ${base64Utf8(JSON.stringify(auth))}`,
  );
}
