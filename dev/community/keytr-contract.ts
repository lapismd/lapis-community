import { bytesToHex } from "@noble/hashes/utils.js";
import { generateSecretKey, getPublicKey } from "nostr-tools/pure";

import {
  createCommunityKeytrLoginIntegration,
  RelayAuthClient,
  SecretKeyRegistrySigner,
  type CommunityKeytrLoginIntegration,
  type CommunitySigner,
} from "../../src/auth/index.js";
import {
  createNip17GiftWraps,
  unwrapNip17GiftWrap,
} from "../../src/community/nip17.js";
import { createWebSocketCommunityRelayFactory } from "../../src/nostr/transport.js";
import { communityKeytrLibrary } from "./keytr-adapter.js";

interface KeytrContractConfiguration {
  relayUrl: string;
  relayHttpUrl: string;
  keytrRelayUrl: string;
  keytrRpId: string;
}

interface KeytrContractResult {
  pubkey: string;
  accountId: string;
  githubStatus: string;
  status: string;
}

let configuration: KeytrContractConfiguration | undefined;
let integration: CommunityKeytrLoginIntegration | undefined;
let client: RelayAuthClient | undefined;
let signer: CommunitySigner | undefined;
let navigation = "";

function configure(next: KeytrContractConfiguration): void {
  configuration = next;
  integration = createCommunityKeytrLoginIntegration({
    library: communityKeytrLibrary,
    relayUrls: [next.keytrRelayUrl],
    gateways: [
      {
        id: next.keytrRpId,
        label: "Community browser contract",
        rpId: next.keytrRpId,
      },
    ],
    allowLocalKeyMethods: true,
    clientName: "Lapis Community auth contract",
  });
  client = new RelayAuthClient({
    relayUrl: next.relayHttpUrl,
    connectIdentity: integration.connect,
    currentUrl: () => window.location.href,
    navigate: (url) => {
      navigation = url;
    },
  });
  signer = undefined;
  navigation = "";
}

async function createIdentity(): Promise<KeytrContractResult> {
  const currentClient = requireClient();
  const result = await currentClient.connect("keytr", {
    keytr: {
      action: "create",
      gatewayId: requireConfiguration().keytrRpId,
      passkeyLabel: "Community browser contract",
    },
  });
  if (result.status !== "connected") throw new Error("Keytr did not connect");
  signer = result.identity;
  return {
    pubkey: result.session.account.nostr_pubkey,
    accountId: result.session.account.id,
    githubStatus: result.session.github_status,
    status: result.status,
  };
}

async function importIdentity(): Promise<KeytrContractResult> {
  const currentClient = requireClient();
  const privateKey = generateSecretKey();
  const expectedPubkey = getPublicKey(privateKey);
  const result = await (async () => {
    try {
      return await currentClient.connect("keytr", {
        keytr: {
          action: "import",
          gatewayId: requireConfiguration().keytrRpId,
          passkeyLabel: "Community browser contract",
          privateKey: bytesToHex(privateKey),
        },
      });
    } finally {
      privateKey.fill(0);
    }
  })();
  if (result.status !== "connected") throw new Error("Keytr did not connect");
  if (result.session.account.nostr_pubkey !== expectedPubkey) {
    result.identity.dispose?.();
    throw new Error("Keytr imported a different identity");
  }
  signer = result.identity;
  return {
    pubkey: result.session.account.nostr_pubkey,
    accountId: result.session.account.id,
    githubStatus: result.session.github_status,
    status: result.status,
  };
}

async function restore(): Promise<KeytrContractResult> {
  const result = await requireClient().restore();
  if (result.status === "anonymous") {
    return {
      pubkey: "",
      accountId: "",
      githubStatus: "",
      status: result.status,
    };
  }
  if (result.status === "connected") signer = result.identity;
  return {
    pubkey: result.session.account.nostr_pubkey,
    accountId: result.session.account.id,
    githubStatus: result.session.github_status,
    status: result.status,
  };
}

async function reconnectIdentity(): Promise<KeytrContractResult> {
  const result = await requireClient().connect("keytr", {
    keytr: {
      action: "login",
      gatewayId: requireConfiguration().keytrRpId,
    },
  });
  if (result.status !== "connected") throw new Error("Keytr did not reconnect");
  signer = result.identity;
  return {
    pubkey: result.session.account.nostr_pubkey,
    accountId: result.session.account.id,
    githubStatus: result.session.github_status,
    status: result.status,
  };
}

async function githubLinkUrl(): Promise<string> {
  await requireClient().connectGitHub();
  if (navigation === "") throw new Error("GitHub navigation was not created");
  return navigation;
}

async function exerciseSigning(): Promise<{
  eventAccepted: boolean;
  nip44RoundTrip: boolean;
  nip17RoundTrip: boolean;
}> {
  const activeSigner = requireSigner();
  const relayFactory = createWebSocketCommunityRelayFactory({
    connectTimeoutMs: 10_000,
    eoseTimeoutMs: 10_000,
    publishTimeoutMs: 10_000,
  });
  const relay = relayFactory.create(requireConfiguration().relayUrl);
  try {
    await relay.authenticate?.((event) => activeSigner.signEvent(event));
    const now = Math.floor(Date.now() / 1_000);
    await relay.publish(
      await activeSigner.signEvent({
        kind: 9_021,
        created_at: now,
        content: "",
        tags: [["h", "general-auth-contract"]],
      }),
    );
    const event = await activeSigner.signEvent({
      kind: 9,
      created_at: now + 1,
      content: "Keytr browser auth channel message",
      tags: [["h", "general-auth-contract"]],
    });
    const eventAccepted = (await relay.publish(event)).accepted;

    const recipient = new SecretKeyRegistrySigner(generateSecretKey());
    const activeNip44 = activeSigner.nip44;
    if (activeNip44 === undefined) throw new Error("Keytr NIP-44 is missing");
    const recipientPubkey = await recipient.getPublicKey();
    const senderPubkey = await activeSigner.getPublicKey();
    const encrypted = await activeNip44.encrypt(
      recipientPubkey,
      "keytr-private",
    );
    const nip44RoundTrip =
      (await recipient.nip44.decrypt(senderPubkey, encrypted)) ===
      "keytr-private";

    const wraps = await createNip17GiftWraps({
      identity: activeSigner,
      recipients: [recipientPubkey],
      content: "Keytr NIP-17 message",
      createdAt: now + 2,
      randomOffsetSeconds: () => 0,
    });
    const recipientWrap = wraps.find((candidate) =>
      candidate.tags.some(
        (tag) => tag[0] === "p" && tag[1] === recipientPubkey,
      ),
    );
    if (recipientWrap === undefined) throw new Error("Recipient wrap missing");
    await relay.publish(recipientWrap);
    const rumor = await unwrapNip17GiftWrap(recipient, recipientWrap);
    recipient.dispose();
    return {
      eventAccepted,
      nip44RoundTrip,
      nip17RoundTrip: rumor.content === "Keytr NIP-17 message",
    };
  } finally {
    relay.close();
  }
}

async function signOut(): Promise<{ status: string; keyUsable: boolean }> {
  const activeSigner = requireSigner();
  await requireClient().signOut();
  activeSigner.dispose?.();
  signer = undefined;
  let keyUsable = true;
  try {
    await activeSigner.signEvent({
      kind: 1,
      created_at: Math.floor(Date.now() / 1_000),
      content: "must fail",
      tags: [],
    });
  } catch {
    keyUsable = false;
  }
  const restored = await requireClient().restore();
  return { status: restored.status, keyUsable };
}

function requireConfiguration(): KeytrContractConfiguration {
  if (configuration === undefined)
    throw new Error("Contract is not configured");
  return configuration;
}

function requireClient(): RelayAuthClient {
  if (client === undefined)
    throw new Error("Contract client is not configured");
  return client;
}

function requireSigner(): CommunitySigner {
  if (signer === undefined) throw new Error("Keytr signer is not connected");
  return signer;
}

const contract = {
  configure,
  createIdentity,
  importIdentity,
  restore,
  reconnectIdentity,
  githubLinkUrl,
  exerciseSigning,
  signOut,
};

Object.assign(window, { keytrContract: contract });

declare global {
  interface Window {
    keytrContract: typeof contract;
  }
}
