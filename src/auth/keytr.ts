import { hexToBytes } from "@noble/hashes/utils.js";
import { nip19 } from "nostr-tools";
import { getPublicKey, verifyEvent } from "nostr-tools/pure";

import type { CommunityLoginMethodModel } from "./login-method.js";
import type { NostrEvent, NostrEventTemplate } from "../protocol/index.js";

import type {
  RelayAuthClientOptions,
  RelayAuthLoginCredentials,
  RelayIdentityConnectContext,
} from "./relay-session.js";
import { SecretKeyRegistrySigner } from "./signer.js";
import type { CommunitySigner } from "./types.js";
import { encodeBase64Url } from "./webauthn.js";

const KEYTR_EVENT_KIND = 31_777;
const KEYTR_VERSION = 1;
const MAX_CIPHERTEXT_LENGTH = 4_096;
const PUBKEY_PATTERN = /^[0-9a-f]{64}$/u;
const RP_ID_PATTERN =
  /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)*[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/u;
const INSECURE_LOCAL_RELAY_HOSTS = new Set(["local-community.lapis.md"]);

export type CommunityKeytrAction = "login" | "create" | "import";

export interface CommunityKeytrGateway {
  id: string;
  label: string;
  rpId: string;
}

export interface CommunityKeytrCapabilities {
  webauthn: boolean;
  platformAuthenticator: boolean;
  prf: boolean | null;
  relatedOrigins: boolean | null;
  signalApi: boolean;
}

export interface CommunityKeytrCredential {
  credentialId: Uint8Array;
  credentialIdBase64url: string;
  rpId: string;
  transports: readonly string[];
}

export interface CommunityKeytrSetupResult {
  credential: CommunityKeytrCredential;
  eventTemplate: NostrEventTemplate;
  nsecBytes: Uint8Array;
}

export interface CommunityKeytrBundle {
  credential: CommunityKeytrCredential;
  eventTemplate: NostrEventTemplate;
}

export interface CommunityKeytrDiscoveryResult {
  keyMaterial: Uint8Array;
  credentialId: Uint8Array;
  mode?: "prf" | "kih";
  pubkey?: string;
}

export interface CommunityKeytrParsedEvent {
  credentialIdBase64url: string;
  credentialId: Uint8Array;
  rpId: string;
  encryptedBlob: string;
  version: number;
  algorithm: string;
  kdf: string;
  transports: readonly string[];
}

/**
 * Narrow structural surface implemented by the host's reviewed Keytr package.
 * Community deliberately owns orchestration and validation around these calls.
 */
export interface CommunityKeytrLibrary {
  checkCapabilities(): Promise<CommunityKeytrCapabilities>;
  setup(options: {
    rpId: string;
    rpName: string;
    userName: string;
    userDisplayName: string;
    clientName?: string;
  }): Promise<CommunityKeytrSetupResult>;
  addBackupGateway(
    nsecBytes: Uint8Array,
    options: {
      rpId: string;
      rpName: string;
      userName: string;
      userDisplayName: string;
      clientName?: string;
    },
  ): Promise<CommunityKeytrBundle>;
  discoverPasskey(options: {
    rpId: string;
    mediation?: "silent" | "optional" | "conditional" | "required";
  }): Promise<CommunityKeytrDiscoveryResult>;
  authenticatePasskey(options: {
    credentialId: Uint8Array;
    rpId: string;
    transports?: readonly string[];
  }): Promise<Uint8Array>;
  fetchKeytrEvents(pubkey: string, relayUrls: string[]): Promise<NostrEvent[]>;
  parseKeytrEvent(event: NostrEvent): CommunityKeytrParsedEvent;
  decryptNsec(options: {
    encryptedBlob: string;
    keyMaterial: Uint8Array;
    credentialId: Uint8Array;
    version: number;
  }): Uint8Array;
  publishKeytrEvent(event: NostrEvent, relayUrls: string[]): Promise<void>;
  signalUnknownCredential?(
    rpId: string,
    credentialId: Uint8Array,
  ): Promise<boolean>;
}

export interface CommunityKeytrConfiguration {
  library: CommunityKeytrLibrary;
  relayUrls: readonly string[];
  gateways?: readonly CommunityKeytrGateway[];
  allowLocalKeyMethods?: boolean;
  defaultPasskeyLabel?: string;
  methodId?: string;
  clientName?: string;
}

export interface CommunityKeytrLoginIntegration {
  method: CommunityLoginMethodModel;
  gateways: readonly CommunityKeytrGateway[];
  relayUrls: readonly string[];
  capabilities(): Promise<CommunityKeytrCapabilities>;
  connect: NonNullable<RelayAuthClientOptions["connectIdentity"]>;
}

export type CommunityKeytrErrorCode =
  | "invalid_configuration"
  | "invalid_action"
  | "invalid_private_key"
  | "unsupported"
  | "cancelled"
  | "authenticator_failed"
  | "credential_not_found"
  | "invalid_event"
  | "pubkey_mismatch"
  | "relay_unavailable"
  | "publish_failed";

const keytrErrorMessages: Record<CommunityKeytrErrorCode, string> = {
  invalid_configuration: "Keytr is not configured for this Community host.",
  invalid_action: "Choose a valid Keytr sign-in action.",
  invalid_private_key: "Use an nsec or a 64-character hexadecimal private key.",
  unsupported: "This browser or authenticator cannot use Keytr passkeys.",
  cancelled: "The Keytr passkey request was cancelled.",
  authenticator_failed:
    "The authenticator could not create or use this Keytr passkey.",
  credential_not_found: "No matching Keytr identity was found.",
  invalid_event: "The stored Keytr identity record is invalid.",
  pubkey_mismatch: "That Keytr passkey belongs to a different Nostr account.",
  relay_unavailable: "Keytr storage relays are temporarily unavailable.",
  publish_failed: "The Keytr identity could not be saved to a storage relay.",
};

export class CommunityKeytrError extends Error {
  readonly code: CommunityKeytrErrorCode;

  constructor(code: CommunityKeytrErrorCode) {
    super(keytrErrorMessages[code]);
    this.name = "CommunityKeytrError";
    this.code = code;
  }
}

export function createCommunityKeytrLoginIntegration(
  options: CommunityKeytrConfiguration,
): CommunityKeytrLoginIntegration {
  const gateways = normalizeGateways(options.gateways);
  const relayUrls = normalizeRelayUrls(options.relayUrls);
  const methodId = options.methodId?.trim() || "keytr";
  const defaultPasskeyLabel =
    options.defaultPasskeyLabel?.trim() || "Lapis Community";
  const method: CommunityLoginMethodModel = {
    id: methodId,
    kind: "keytr",
    label: "Continue with Keytr",
    description: "Use a passkey-protected Nostr key",
    keytr: {
      gateways,
      allowSetup: true,
      allowImport: options.allowLocalKeyMethods === true,
      defaultPasskeyLabel,
    },
  };

  const capabilities = async (): Promise<CommunityKeytrCapabilities> => {
    try {
      return await options.library.checkCapabilities();
    } catch (cause) {
      throw mapKeytrError(cause, "unsupported");
    }
  };

  const connect = async (
    selectedMethodId: string,
    credentials?: RelayAuthLoginCredentials,
    context?: RelayIdentityConnectContext,
  ): Promise<CommunitySigner> => {
    if (selectedMethodId !== methodId) {
      throw new CommunityKeytrError("invalid_action");
    }
    const request = credentials?.keytr;
    if (request === undefined) {
      throw new CommunityKeytrError("invalid_action");
    }
    const gateway = gateways.find((entry) => entry.id === request.gatewayId);
    if (gateway === undefined) {
      throw new CommunityKeytrError("invalid_configuration");
    }
    const support = await capabilities();
    if (!support.webauthn || support.prf === false) {
      throw new CommunityKeytrError("unsupported");
    }
    if (request.action === "login") {
      return await recoverIdentity(
        options.library,
        gateway,
        relayUrls,
        context?.expectedPubkey,
      );
    }
    if (request.action !== "create" && request.action !== "import") {
      throw new CommunityKeytrError("invalid_action");
    }
    if (request.action === "import" && options.allowLocalKeyMethods !== true) {
      throw new CommunityKeytrError("invalid_action");
    }
    const label = request.passkeyLabel?.trim() || defaultPasskeyLabel;
    return await createIdentity(
      options.library,
      gateway,
      relayUrls,
      request.action,
      label,
      request.privateKey,
      options.clientName,
    );
  };

  return { method, gateways, relayUrls, capabilities, connect };
}

export function validateCommunityKeytrEvent(
  event: NostrEvent,
  options: { expectedPubkey?: string; rpId: string },
): void {
  if (
    event.kind !== KEYTR_EVENT_KIND ||
    !PUBKEY_PATTERN.test(event.pubkey) ||
    (options.expectedPubkey !== undefined &&
      event.pubkey !== options.expectedPubkey) ||
    !verifyEvent({
      id: event.id,
      pubkey: event.pubkey,
      created_at: event.created_at,
      kind: event.kind,
      tags: event.tags.map((tag) => [...tag]),
      content: event.content,
      sig: event.sig,
    }) ||
    event.content.length < 1 ||
    event.content.length > MAX_CIPHERTEXT_LENGTH
  ) {
    throw new CommunityKeytrError("invalid_event");
  }
  const required = new Map([
    ["d", undefined],
    ["rp", options.rpId],
    ["algo", "aes-256-gcm"],
    ["kdf", "hkdf-sha256"],
    ["v", String(KEYTR_VERSION)],
  ] as const);
  for (const [name, expected] of required) {
    const matches = event.tags.filter((tag) => tag[0] === name);
    if (
      matches.length !== 1 ||
      matches[0] === undefined ||
      matches[0].length !== 2 ||
      matches[0][1] === undefined ||
      matches[0][1] === "" ||
      (expected !== undefined && matches[0][1] !== expected)
    ) {
      throw new CommunityKeytrError("invalid_event");
    }
  }
  const dTag = event.tags.find((tag) => tag[0] === "d")?.[1] ?? "";
  if (
    dTag.length > 1_024 ||
    !/^[A-Za-z0-9_-]+={0,2}$/u.test(dTag) ||
    dTag.length % 4 === 1
  ) {
    throw new CommunityKeytrError("invalid_event");
  }
}

async function recoverIdentity(
  library: CommunityKeytrLibrary,
  gateway: CommunityKeytrGateway,
  relayUrls: readonly string[],
  expectedPubkey?: string,
): Promise<CommunitySigner> {
  try {
    if (expectedPubkey !== undefined) {
      if (!PUBKEY_PATTERN.test(expectedPubkey)) {
        throw new CommunityKeytrError("pubkey_mismatch");
      }
      const events = await library.fetchKeytrEvents(expectedPubkey, [
        ...relayUrls,
      ]);
      return await recoverKnownIdentity(
        library,
        gateway,
        events,
        expectedPubkey,
      );
    }
    const discovered = await library.discoverPasskey({
      rpId: gateway.rpId,
      mediation: "required",
    });
    try {
      if (
        discovered.mode === "kih" ||
        discovered.pubkey === undefined ||
        !PUBKEY_PATTERN.test(discovered.pubkey)
      ) {
        throw new CommunityKeytrError("unsupported");
      }
      const events = await library.fetchKeytrEvents(discovered.pubkey, [
        ...relayUrls,
      ]);
      const dTag = encodeBase64Url(discovered.credentialId);
      const event = events.find(
        (candidate) =>
          candidate.tags.some(
            (tag) =>
              tag[0] === "d" &&
              tag[1] !== undefined &&
              normalizeBase64Url(tag[1]) === dTag,
          ) &&
          candidate.tags.some(
            (tag) => tag[0] === "rp" && tag[1] === gateway.rpId,
          ),
      );
      if (event === undefined) {
        throw new CommunityKeytrError("credential_not_found");
      }
      return await decryptIdentity(
        library,
        event,
        gateway.rpId,
        discovered.keyMaterial,
        discovered.credentialId,
        discovered.pubkey,
      );
    } finally {
      discovered.keyMaterial.fill(0);
    }
  } catch (cause) {
    throw mapKeytrError(cause, "credential_not_found");
  }
}

async function recoverKnownIdentity(
  library: CommunityKeytrLibrary,
  gateway: CommunityKeytrGateway,
  events: readonly NostrEvent[],
  expectedPubkey: string,
): Promise<CommunitySigner> {
  const candidates: NostrEvent[] = [];
  let validationFailure: CommunityKeytrError | undefined;
  for (const event of events) {
    if (!event.tags.some((tag) => tag[0] === "rp" && tag[1] === gateway.rpId)) {
      continue;
    }
    try {
      validateCommunityKeytrEvent(event, {
        expectedPubkey,
        rpId: gateway.rpId,
      });
      candidates.push(event);
    } catch (cause) {
      validationFailure = mapKeytrError(cause, "invalid_event");
    }
  }
  if (candidates.length === 0) {
    throw validationFailure ?? new CommunityKeytrError("credential_not_found");
  }
  let lastError: unknown;
  for (const event of candidates.toSorted(
    (left, right) => right.created_at - left.created_at,
  )) {
    const parsed = parseValidatedEvent(
      library,
      event,
      expectedPubkey,
      gateway.rpId,
    );
    let keyMaterial: Uint8Array | undefined;
    try {
      keyMaterial = await library.authenticatePasskey({
        credentialId: parsed.credentialId,
        rpId: parsed.rpId,
        transports: parsed.transports,
      });
      return await decryptIdentity(
        library,
        event,
        gateway.rpId,
        keyMaterial,
        parsed.credentialId,
        expectedPubkey,
      );
    } catch (cause) {
      lastError = cause;
    } finally {
      keyMaterial?.fill(0);
    }
  }
  throw mapKeytrError(lastError, "credential_not_found");
}

async function decryptIdentity(
  library: CommunityKeytrLibrary,
  event: NostrEvent,
  rpId: string,
  keyMaterial: Uint8Array,
  credentialId: Uint8Array,
  expectedPubkey: string,
): Promise<CommunitySigner> {
  const parsed = parseValidatedEvent(library, event, expectedPubkey, rpId);
  if (
    encodeBase64Url(credentialId) !==
    normalizeBase64Url(parsed.credentialIdBase64url)
  ) {
    throw new CommunityKeytrError("invalid_event");
  }
  const secret = library.decryptNsec({
    encryptedBlob: parsed.encryptedBlob,
    keyMaterial,
    credentialId,
    version: parsed.version,
  });
  try {
    const signer = new SecretKeyRegistrySigner(secret);
    const actualPubkey = await signer.getPublicKey();
    if (actualPubkey !== expectedPubkey || event.pubkey !== actualPubkey) {
      signer.dispose();
      throw new CommunityKeytrError("pubkey_mismatch");
    }
    return signer;
  } finally {
    secret.fill(0);
  }
}

async function createIdentity(
  library: CommunityKeytrLibrary,
  gateway: CommunityKeytrGateway,
  relayUrls: readonly string[],
  action: "create" | "import",
  passkeyLabel: string,
  privateKey: string | undefined,
  clientName: string | undefined,
): Promise<CommunitySigner> {
  let secret: Uint8Array | undefined;
  let signer: SecretKeyRegistrySigner | undefined;
  let credential: CommunityKeytrCredential | undefined;
  try {
    const setupOptions = {
      rpId: gateway.rpId,
      rpName: gateway.label,
      userName: passkeyLabel,
      userDisplayName: passkeyLabel,
      ...(clientName === undefined ? {} : { clientName }),
    };
    let template: NostrEventTemplate;
    if (action === "create") {
      const result = await library.setup(setupOptions);
      secret = result.nsecBytes;
      credential = result.credential;
      template = result.eventTemplate;
    } else {
      secret = decodeImportedPrivateKey(privateKey);
      const result = await library.addBackupGateway(secret, setupOptions);
      credential = result.credential;
      template = result.eventTemplate;
    }
    signer = new SecretKeyRegistrySigner(secret);
    const pubkey = await signer.getPublicKey();
    secret.fill(0);
    secret = undefined;
    const event = await signer.signEvent(copyTemplate(template));
    validateCommunityKeytrEvent(event, {
      expectedPubkey: pubkey,
      rpId: gateway.rpId,
    });
    try {
      await library.publishKeytrEvent(event, [...relayUrls]);
    } catch {
      await requestCredentialCleanup(library, gateway.rpId, credential);
      throw new CommunityKeytrError("publish_failed");
    }
    return signer;
  } catch (cause) {
    signer?.dispose();
    throw mapKeytrError(cause, "authenticator_failed");
  } finally {
    secret?.fill(0);
  }
}

function parseValidatedEvent(
  library: CommunityKeytrLibrary,
  event: NostrEvent,
  expectedPubkey: string,
  rpId: string,
): CommunityKeytrParsedEvent {
  validateCommunityKeytrEvent(event, { expectedPubkey, rpId });
  let parsed: CommunityKeytrParsedEvent;
  try {
    parsed = library.parseKeytrEvent(event);
  } catch {
    throw new CommunityKeytrError("invalid_event");
  }
  if (
    parsed.rpId !== rpId ||
    parsed.version !== KEYTR_VERSION ||
    parsed.algorithm !== "aes-256-gcm" ||
    parsed.kdf !== "hkdf-sha256" ||
    encodeBase64Url(parsed.credentialId) !==
      normalizeBase64Url(parsed.credentialIdBase64url)
  ) {
    throw new CommunityKeytrError("invalid_event");
  }
  return parsed;
}

function decodeImportedPrivateKey(value: string | undefined): Uint8Array {
  if (value === undefined || value.trim() === "") {
    throw new CommunityKeytrError("invalid_private_key");
  }
  let secret: Uint8Array | undefined;
  try {
    const normalized = value.trim();
    if (/^[0-9a-f]{64}$/iu.test(normalized)) {
      secret = hexToBytes(normalized);
    } else {
      const decoded = nip19.decode(normalized);
      if (decoded.type !== "nsec" || !(decoded.data instanceof Uint8Array)) {
        throw new Error("not a private key");
      }
      secret = decoded.data;
    }
    getPublicKey(secret);
    return secret;
  } catch {
    secret?.fill(0);
    throw new CommunityKeytrError("invalid_private_key");
  }
}

function normalizeBase64Url(value: string): string {
  return value.replace(/=+$/u, "");
}

function copyTemplate(template: NostrEventTemplate): NostrEventTemplate {
  if (
    template.kind !== KEYTR_EVENT_KIND ||
    !Number.isSafeInteger(template.created_at) ||
    typeof template.content !== "string" ||
    !Array.isArray(template.tags)
  ) {
    throw new CommunityKeytrError("invalid_event");
  }
  return {
    kind: template.kind,
    created_at: template.created_at,
    content: template.content,
    tags: template.tags.map((tag) => [...tag]),
  };
}

async function requestCredentialCleanup(
  library: CommunityKeytrLibrary,
  rpId: string,
  credential: CommunityKeytrCredential | undefined,
): Promise<void> {
  if (
    credential === undefined ||
    library.signalUnknownCredential === undefined
  ) {
    return;
  }
  try {
    await library.signalUnknownCredential(rpId, credential.credentialId);
  } catch {
    // Cleanup is advisory and must not replace the publication error.
  }
}

function normalizeGateways(
  input: readonly CommunityKeytrGateway[] | undefined,
): readonly CommunityKeytrGateway[] {
  const gateways =
    input === undefined
      ? [{ id: "keytr.org", label: "Keytr", rpId: "keytr.org" }]
      : input;
  if (gateways.length === 0) {
    throw new CommunityKeytrError("invalid_configuration");
  }
  const ids = new Set<string>();
  const rpIds = new Set<string>();
  return gateways.map((gateway) => {
    const id = gateway.id.trim();
    const label = gateway.label.trim();
    const rpId = gateway.rpId.trim().toLowerCase();
    if (
      id === "" ||
      label === "" ||
      !RP_ID_PATTERN.test(rpId) ||
      ids.has(id) ||
      rpIds.has(rpId)
    ) {
      throw new CommunityKeytrError("invalid_configuration");
    }
    ids.add(id);
    rpIds.add(rpId);
    return { id, label, rpId };
  });
}

function normalizeRelayUrls(input: readonly string[]): readonly string[] {
  if (input.length === 0) {
    throw new CommunityKeytrError("invalid_configuration");
  }
  const urls = new Set<string>();
  for (const value of input) {
    let url: URL;
    try {
      url = new URL(value);
    } catch {
      throw new CommunityKeytrError("invalid_configuration");
    }
    const local =
      url.hostname === "localhost" ||
      url.hostname.endsWith(".localhost") ||
      INSECURE_LOCAL_RELAY_HOSTS.has(url.hostname);
    if (
      (url.protocol !== "wss:" && !(url.protocol === "ws:" && local)) ||
      url.username !== "" ||
      url.password !== "" ||
      url.search !== "" ||
      url.hash !== ""
    ) {
      throw new CommunityKeytrError("invalid_configuration");
    }
    urls.add(url.toString());
  }
  return [...urls];
}

function mapKeytrError(
  cause: unknown,
  fallback: CommunityKeytrErrorCode,
): CommunityKeytrError {
  if (cause instanceof CommunityKeytrError) return cause;
  const name =
    typeof cause === "object" && cause !== null && "name" in cause
      ? String(cause.name)
      : "";
  if (name === "AbortError" || name === "NotAllowedError") {
    return new CommunityKeytrError("cancelled");
  }
  if (
    name === "PrfNotSupportedError" ||
    name === "KihRegistrationDisabledError" ||
    name === "NotSupportedError" ||
    name === "SecurityError"
  ) {
    return new CommunityKeytrError("unsupported");
  }
  if (name === "RelayError") {
    return new CommunityKeytrError("relay_unavailable");
  }
  if (name === "WebAuthnError") {
    return new CommunityKeytrError("authenticator_failed");
  }
  return new CommunityKeytrError(fallback);
}
