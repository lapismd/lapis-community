import { createServer as createHttpServer } from "node:http";
import { fileURLToPath } from "node:url";

import { nip19 } from "nostr-tools";
import { getPublicKey, verifyEvent } from "nostr-tools/pure";
import { chromium, type Browser, type Page } from "playwright";
import { describe, expect, it } from "vitest";
import { createServer as createViteServer } from "vite";
import { WebSocketServer } from "ws";

import {
  type CommunityCredentialsContainer,
  RelayAuthClient,
  RelayAuthError,
  SecretKeyRegistrySigner,
} from "../auth/index.js";
import {
  createNip17GiftWraps,
  unwrapNip17GiftWrap,
} from "../community/index.js";
import { createWebSocketCommunityRelayFactory } from "../nostr/index.js";
import type { NostrEvent } from "../protocol/index.js";
import {
  createNip34ProjectForgeDataSource,
  createRepositoryTemplate,
} from "../projects/index.js";

const relayUrl = process.env.COMMUNITY_RELAY_URL;
const relayHttpUrl = process.env.COMMUNITY_RELAY_HTTP_URL;
const browserOrigin = process.env.COMMUNITY_AUTH_BROWSER_ORIGIN;
const fakeOAuthUrl = process.env.COMMUNITY_FAKE_OAUTH_URL;

interface BrowserKeytrResult {
  pubkey: string;
  accountId: string;
  githubStatus: string;
  status: string;
}

declare global {
  interface Window {
    keytrContract: {
      configure(configuration: {
        relayUrl: string;
        relayHttpUrl: string;
        keytrRelayUrl: string;
        keytrRpId: string;
      }): void;
      createIdentity(): Promise<BrowserKeytrResult>;
      restore(): Promise<BrowserKeytrResult>;
      reconnectIdentity(): Promise<BrowserKeytrResult>;
      githubLinkUrl(): Promise<string>;
      exerciseSigning(): Promise<{
        eventAccepted: boolean;
        nip44RoundTrip: boolean;
        nip17RoundTrip: boolean;
      }>;
      signOut(): Promise<{ status: string; keyUsable: boolean }>;
    };
  }
}

if (!relayUrl || !relayHttpUrl || !browserOrigin || !fakeOAuthUrl) {
  describe.skip("Community relay auth Docker contract", () => {
    it("requires the Docker auth environment", () => undefined);
  });
} else {
  describe("Community relay auth Docker contract", () => {
    it("uses managed Google and linked GitHub identity across Community protocols", async () => {
      const sessionFetch = createSessionFetch(relayHttpUrl, browserOrigin);
      const navigations: string[] = [];
      const currentUrl = `${browserOrigin}/projects?view=mine#/pull/42`;
      const client = new RelayAuthClient({
        relayUrl: relayHttpUrl,
        fetch: sessionFetch.fetch,
        currentUrl: () => currentUrl,
        navigate: (url) => navigations.push(url),
      });

      const preflight = await fetch(`${relayHttpUrl}/api/auth/session`, {
        method: "OPTIONS",
        headers: {
          Origin: browserOrigin,
          "Access-Control-Request-Method": "GET",
        },
      });
      expect(preflight.status).toBe(204);
      expect(preflight.headers.get("access-control-allow-origin")).toBe(
        browserOrigin,
      );
      expect(preflight.headers.get("access-control-allow-credentials")).toBe(
        "true",
      );

      await client.connect("google");
      await completeOAuth(
        navigations.pop(),
        sessionFetch,
        fakeOAuthUrl,
        currentUrl,
      );
      const restored = await client.restore();
      expect(restored.status).toBe("connected");
      if (restored.status !== "connected")
        throw new Error("managed session missing");
      expect(restored.session).toMatchObject({
        auth_provider: "google",
        github_status: "unlinked",
        signer_type: "managed",
        signer_status: "active",
        identities: [
          {
            provider: "google",
            display_name: "Community Tester",
          },
        ],
      });
      const accountId = restored.session.account.id;
      const pubkey = restored.session.account.nostr_pubkey;
      const signer = restored.identity;
      const managedNip44 = signer.nip44;
      if (managedNip44 === undefined) {
        throw new Error("managed signer NIP-44 is missing");
      }

      const secondClient = new RelayAuthClient({
        relayUrl: relayHttpUrl,
        fetch: sessionFetch.fetch,
        currentUrl: () => currentUrl,
      });
      const restoredAgain = await secondClient.restore();
      expect(restoredAgain.status).toBe("connected");
      if (restoredAgain.status !== "connected") {
        throw new Error("restored signer missing");
      }
      expect(await restoredAgain.identity.getPublicKey()).toBe(pubkey);

      const relayFactory = createWebSocketCommunityRelayFactory({
        connectTimeoutMs: 10_000,
        eoseTimeoutMs: 10_000,
        publishTimeoutMs: 10_000,
      });
      const relay = relayFactory.create(relayUrl);
      try {
        await relay.authenticate?.((template) => signer.signEvent(template));
        const now = Math.floor(Date.now() / 1_000);
        const join = await signer.signEvent({
          kind: 9_021,
          created_at: now,
          content: "",
          tags: [["h", "general-auth-contract"]],
        });
        await expect(relay.publish(join)).resolves.toMatchObject({
          accepted: true,
        });
        const channelEvent = await signer.signEvent({
          kind: 9,
          created_at: now + 1,
          content: "Managed auth channel message",
          tags: [["h", "general-auth-contract"]],
        });
        await expect(relay.publish(channelEvent)).resolves.toMatchObject({
          accepted: true,
        });

        const profile = await signer.signEvent({
          kind: 0,
          created_at: now + 2,
          content: JSON.stringify({
            name: "community-tester",
            display_name: "Community Tester",
          }),
          tags: [],
        });
        await expect(relay.publish(profile)).resolves.toMatchObject({
          accepted: true,
        });

        const pulse = await signer.signEvent({
          kind: 1,
          created_at: now + 3,
          content: "Managed auth Pulse note",
          tags: [],
        });
        await relay.publish(pulse);
        const reaction = await signer.signEvent({
          kind: 7,
          created_at: now + 4,
          content: "+",
          tags: [
            ["e", pulse.id],
            ["p", pulse.pubkey],
            ["k", "1"],
          ],
        });
        await relay.publish(reaction);

        expect(
          await relay.query({
            ids: [channelEvent.id, profile.id, pulse.id, reaction.id],
          }),
        ).toHaveLength(4);

        const memberSecret = new Uint8Array(32).fill(22);
        const member = new SecretKeyRegistrySigner(memberSecret);
        const memberPubkey = getPublicKey(memberSecret);
        const outbound = await managedNip44.encrypt(
          memberPubkey,
          "managed-to-member",
        );
        await expect(member.nip44.decrypt(pubkey, outbound)).resolves.toBe(
          "managed-to-member",
        );
        const inbound = await member.nip44.encrypt(pubkey, "member-to-managed");
        await expect(managedNip44.decrypt(memberPubkey, inbound)).resolves.toBe(
          "member-to-managed",
        );

        const wraps = await createNip17GiftWraps({
          identity: signer,
          recipients: [memberPubkey],
          content: "Managed NIP-17 message",
          createdAt: now + 5,
          randomOffsetSeconds: () => 0,
        });
        for (const wrap of wraps) await relay.publish(wrap);
        const recipientWrap = wraps.find((event) =>
          event.tags.some((tag) => tag[0] === "p" && tag[1] === memberPubkey),
        );
        expect(recipientWrap).toBeDefined();
        await expect(
          unwrapNip17GiftWrap(member, recipientWrap!),
        ).resolves.toMatchObject({ content: "Managed NIP-17 message" });

        const repositoryTemplate = createRepositoryTemplate(
          {
            identifier: "auth-contract",
            name: "Auth contract",
            description: "Managed NIP-98 read fixture",
            channelId: "general-auth-contract",
          },
          now + 6,
        );
        const repository = await signer.signEvent({
          ...repositoryTemplate,
          tags: [...repositoryTemplate.tags, ["project-task-anchor", "true"]],
        });
        await relay.publish(repository);
        const repositoryCoordinate = `30617:${pubkey}:auth-contract`;
        const projectSource = createNip34ProjectForgeDataSource({
          relayFactory,
          fetch: globalThis.fetch.bind(globalThis),
        });
        const project = await projectSource.open({
          relayUrl,
          httpBaseUrl: relayHttpUrl,
          identity: signer,
        });
        try {
          await expect(
            project.loadCapabilities(repositoryCoordinate),
          ).resolves.toMatchObject({ repository: repositoryCoordinate });
        } finally {
          project.close();
        }
      } finally {
        relay.close();
      }

      await client.connectGitHub();
      await completeOAuth(
        navigations.pop(),
        sessionFetch,
        fakeOAuthUrl,
        currentUrl,
      );
      const linked = await client.restore();
      expect(linked.status).toBe("connected");
      if (linked.status !== "connected")
        throw new Error("linked session missing");
      expect(linked.session).toMatchObject({
        auth_provider: "github",
        github_status: "active",
      });
      expect(linked.session.account).toMatchObject({
        id: accountId,
        nostr_pubkey: pubkey,
      });
      expect(linked.session.identities).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ provider: "google" }),
          expect.objectContaining({
            provider: "github",
            login: "community-tester",
          }),
        ]),
      );

      await client.signOut();
      await expect(client.getSession()).rejects.toBeInstanceOf(RelayAuthError);

      await client.connect("github");
      await completeOAuth(
        navigations.pop(),
        sessionFetch,
        fakeOAuthUrl,
        currentUrl,
      );
      const githubLogin = await client.restore();
      expect(githubLogin.status).toBe("connected");
      if (githubLogin.status !== "connected")
        throw new Error("GitHub session missing");
      expect(githubLogin.session.account).toMatchObject({
        id: accountId,
        nostr_pubkey: pubkey,
      });
      expect(githubLogin.session.github_status).toBe("active");

      const passkeys = await createVirtualPasskeyContainer(browserOrigin);
      try {
        const passkeyClient = new RelayAuthClient({
          relayUrl: relayHttpUrl,
          fetch: sessionFetch.fetch,
          currentUrl: () => currentUrl,
          credentials: passkeys.credentials,
        });
        const passkeyRestore = await passkeyClient.restore();
        expect(passkeyRestore.config.capabilities).toMatchObject({
          passkey_registration: true,
          custody_transfer: true,
        });
        const registered = await passkeyClient.registerPasskey();
        expect(registered.session.passkey_count).toBe(1);

        const handoff = await passkeyClient.beginCustodyTransfer();
        const decoded = nip19.decode(handoff.revealNsec());
        expect(decoded.type).toBe("nsec");
        if (decoded.type !== "nsec") throw new Error("transferred key missing");
        expect(getPublicKey(decoded.data)).toBe(pubkey);
        handoff.discardPrivateKey();
        await expect(passkeyClient.getSession()).resolves.toMatchObject({
          signer_type: "managed",
          signer_status: "migration_pending",
          passkey_count: 1,
        });
      } finally {
        await passkeys.close();
      }

      await client.signOut();
      await expect(client.getSession()).rejects.toMatchObject({ status: 401 });
    }, 90_000);

    it("creates, clears, and recovers a Keytr identity with a PRF authenticator", async () => {
      const target = new URL(browserOrigin);
      const vite = await createViteServer({
        root: fileURLToPath(new URL("../../", import.meta.url)),
        configFile: false,
        logLevel: "error",
        server: {
          host: target.hostname,
          port: Number(target.port),
          strictPort: true,
        },
        optimizeDeps: { noDiscovery: true, include: ["semver"] },
        esbuild: { target: "esnext" },
      });
      const keytrRelay = await createKeytrStorageRelay();
      let browser: Browser | undefined;
      try {
        await vite.listen();
        browser = await chromium.launch({ headless: true });
        const page = await browser.newPage();
        const cdp = await page.context().newCDPSession(page);
        await cdp.send("WebAuthn.enable");
        await cdp.send("WebAuthn.addVirtualAuthenticator", {
          options: {
            protocol: "ctap2",
            transport: "internal",
            hasResidentKey: true,
            hasUserVerification: true,
            isUserVerified: true,
            automaticPresenceSimulation: true,
            hasPrf: true,
          },
        });
        const contractUrl = `${browserOrigin}/dev/community/keytr-contract.html`;
        await page.goto(contractUrl);
        await waitForKeytrContract(page);
        const configuration = {
          relayUrl,
          relayHttpUrl,
          keytrRelayUrl: keytrRelay.url,
          keytrRpId: target.hostname,
        };
        await page.evaluate((value) => {
          window.keytrContract.configure(value);
        }, configuration);

        const created = await page.evaluate(() =>
          window.keytrContract.createIdentity(),
        );
        expect(created).toMatchObject({
          status: "connected",
          githubStatus: "unlinked",
        });
        expect(created.pubkey).toMatch(/^[0-9a-f]{64}$/u);

        const selectedIdentity = await fetch(
          `${fakeOAuthUrl}/test/github-identity?variant=keytr`,
          { method: "POST" },
        );
        expect(selectedIdentity.ok).toBe(true);
        const githubUrl = await page.evaluate(() =>
          window.keytrContract.githubLinkUrl(),
        );
        expect(new URL(githubUrl).searchParams.get("intent")).toBe("link");
        await page.goto(githubUrl, { waitUntil: "networkidle" });
        expect(new URL(page.url()).origin).toBe(browserOrigin);
        await waitForKeytrContract(page);
        await page.evaluate((value) => {
          window.keytrContract.configure(value);
        }, configuration);
        const restored = await page.evaluate(() =>
          window.keytrContract.restore(),
        );
        expect(restored).toMatchObject({
          status: "reconnect-required",
          pubkey: created.pubkey,
          accountId: created.accountId,
          githubStatus: "active",
        });

        const reconnected = await page.evaluate(() =>
          window.keytrContract.reconnectIdentity(),
        );
        expect(reconnected).toMatchObject({
          status: "connected",
          pubkey: created.pubkey,
          accountId: created.accountId,
          githubStatus: "active",
        });
        await expect(
          page.evaluate(() => window.keytrContract.exerciseSigning()),
        ).resolves.toEqual({
          eventAccepted: true,
          nip44RoundTrip: true,
          nip17RoundTrip: true,
        });

        await expect(
          page.evaluate(() => window.keytrContract.signOut()),
        ).resolves.toEqual({ status: "anonymous", keyUsable: false });
        const coldReconnect = await page.evaluate(() =>
          window.keytrContract.reconnectIdentity(),
        );
        expect(coldReconnect).toMatchObject({
          status: "connected",
          pubkey: created.pubkey,
          accountId: created.accountId,
        });
        await page.evaluate(() => window.keytrContract.signOut());
      } finally {
        await browser?.close();
        await vite.close();
        await keytrRelay.close();
      }
    }, 90_000);
  });
}

interface VirtualPasskeyContainer {
  credentials: CommunityCredentialsContainer;
  close(): Promise<void>;
}

interface SerializedBrowserCredential {
  id: string;
  rawId: number[];
  type: "public-key";
  authenticatorAttachment: string | null;
  clientExtensionResults: AuthenticationExtensionsClientOutputs;
  response:
    | {
        kind: "attestation";
        attestationObject: number[];
        clientDataJSON: number[];
        transports: AuthenticatorTransport[];
      }
    | {
        kind: "assertion";
        authenticatorData: number[];
        clientDataJSON: number[];
        signature: number[];
        userHandle: number[] | null;
      };
}

async function createVirtualPasskeyContainer(
  origin: string,
): Promise<VirtualPasskeyContainer> {
  const target = new URL(origin);
  const port = Number(target.port || "80");
  const server = createHttpServer((_request, response) => {
    response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    response.end("<!doctype html><title>Community passkey contract</title>");
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, resolve);
  });

  let browser: Browser | undefined;
  try {
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("WebAuthn.enable");
    await cdp.send("WebAuthn.addVirtualAuthenticator", {
      options: {
        protocol: "ctap2",
        transport: "internal",
        hasResidentKey: true,
        hasUserVerification: true,
        isUserVerified: true,
        automaticPresenceSimulation: true,
        hasPrf: true,
      },
    });
    await page.goto(origin);
    const restoreGlobals = installCredentialConstructors();
    return {
      credentials: {
        create: async (options) =>
          reconstructCredential(await createBrowserCredential(page, options)),
        get: async (options) =>
          reconstructCredential(await getBrowserCredential(page, options)),
      },
      close: async () => {
        restoreGlobals();
        await browser?.close();
        await new Promise<void>((resolve, reject) =>
          server.close((error) => (error ? reject(error) : resolve())),
        );
      },
    };
  } catch (cause) {
    await browser?.close();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    throw cause;
  }
}

async function waitForKeytrContract(page: Page): Promise<void> {
  await page.waitForFunction(() => window.keytrContract !== undefined);
}

async function createKeytrStorageRelay(): Promise<{
  url: string;
  close(): Promise<void>;
}> {
  const server = createHttpServer();
  const relay = new WebSocketServer({ server });
  const events = new Map<string, NostrEvent>();
  relay.on("connection", (socket) => {
    socket.on("message", (data) => {
      let message: unknown;
      try {
        message = JSON.parse(data.toString());
      } catch {
        return;
      }
      if (!Array.isArray(message)) return;
      if (message[0] === "EVENT") {
        const event = message[1] as NostrEvent | undefined;
        if (event !== undefined && verifyEvent(event)) {
          events.set(event.id, event);
          socket.send(JSON.stringify(["OK", event.id, true, ""]));
        }
        return;
      }
      if (message[0] !== "REQ" || typeof message[1] !== "string") return;
      const subscriptionId = message[1];
      const filters = message
        .slice(2)
        .filter(
          (value): value is Record<string, unknown> =>
            typeof value === "object" && value !== null,
        );
      for (const event of events.values()) {
        if (filters.some((filter) => matchesNostrFilter(event, filter))) {
          socket.send(JSON.stringify(["EVENT", subscriptionId, event]));
        }
      }
      socket.send(JSON.stringify(["EOSE", subscriptionId]));
    });
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "0.0.0.0", resolve);
  });
  const address = server.address();
  if (address === null || typeof address === "string") {
    throw new Error("Keytr storage relay did not allocate a port");
  }
  return {
    url: `ws://keytr-storage.localhost:${address.port}`,
    close: async () => {
      for (const client of relay.clients) client.terminate();
      await new Promise<void>((resolve, reject) =>
        relay.close((error) => (error ? reject(error) : resolve())),
      );
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
    },
  };
}

function matchesNostrFilter(
  event: NostrEvent,
  filter: Record<string, unknown>,
): boolean {
  if (Array.isArray(filter.authors) && !filter.authors.includes(event.pubkey)) {
    return false;
  }
  if (Array.isArray(filter.kinds) && !filter.kinds.includes(event.kind)) {
    return false;
  }
  const dValues = filter["#d"];
  if (Array.isArray(dValues)) {
    return event.tags.some((tag) => tag[0] === "d" && dValues.includes(tag[1]));
  }
  return true;
}

async function createBrowserCredential(
  page: Page,
  options?: CredentialCreationOptions,
): Promise<SerializedBrowserCredential> {
  if (options?.publicKey === undefined)
    throw new Error("creation options missing");
  const publicKey = options.publicKey;
  return (await page.evaluate(
    async (raw) => {
      const serialized = raw as unknown as Record<string, unknown> & {
        challenge: number[];
        user: Record<string, unknown> & { id: number[] };
        excludeCredentials?: (Record<string, unknown> & { id: number[] })[];
      };
      const credential = (await navigator.credentials.create({
        publicKey: {
          ...serialized,
          challenge: new Uint8Array(serialized.challenge),
          user: {
            ...serialized.user,
            id: new Uint8Array(serialized.user.id),
          },
          excludeCredentials: serialized.excludeCredentials?.map(
            (descriptor) => ({
              ...descriptor,
              id: new Uint8Array(descriptor.id),
            }),
          ),
        } as unknown as PublicKeyCredentialCreationOptions,
      })) as PublicKeyCredential;
      const response = credential.response as AuthenticatorAttestationResponse;
      return {
        id: credential.id,
        rawId: Array.from(new Uint8Array(credential.rawId)),
        type: "public-key" as const,
        authenticatorAttachment: credential.authenticatorAttachment,
        clientExtensionResults: credential.getClientExtensionResults(),
        response: {
          kind: "attestation" as const,
          attestationObject: Array.from(
            new Uint8Array(response.attestationObject),
          ),
          clientDataJSON: Array.from(new Uint8Array(response.clientDataJSON)),
          transports: response.getTransports(),
        },
      };
    },
    {
      ...publicKey,
      challenge: bytes(publicKey.challenge),
      user: { ...publicKey.user, id: bytes(publicKey.user.id) },
      ...(publicKey.excludeCredentials === undefined
        ? {}
        : {
            excludeCredentials: publicKey.excludeCredentials.map(
              (descriptor) => ({
                ...descriptor,
                id: bytes(descriptor.id),
              }),
            ),
          }),
    },
  )) as SerializedBrowserCredential;
}

async function getBrowserCredential(
  page: Page,
  options?: CredentialRequestOptions,
): Promise<SerializedBrowserCredential> {
  if (options?.publicKey === undefined)
    throw new Error("request options missing");
  const publicKey = options.publicKey;
  return (await page.evaluate(
    async (raw) => {
      const serialized = raw as unknown as Record<string, unknown> & {
        challenge: number[];
        allowCredentials?: (Record<string, unknown> & { id: number[] })[];
      };
      const credential = (await navigator.credentials.get({
        publicKey: {
          ...serialized,
          challenge: new Uint8Array(serialized.challenge),
          allowCredentials: serialized.allowCredentials?.map((descriptor) => ({
            ...descriptor,
            id: new Uint8Array(descriptor.id),
          })),
        } as unknown as PublicKeyCredentialRequestOptions,
      })) as PublicKeyCredential;
      const response = credential.response as AuthenticatorAssertionResponse;
      return {
        id: credential.id,
        rawId: Array.from(new Uint8Array(credential.rawId)),
        type: "public-key" as const,
        authenticatorAttachment: credential.authenticatorAttachment,
        clientExtensionResults: credential.getClientExtensionResults(),
        response: {
          kind: "assertion" as const,
          authenticatorData: Array.from(
            new Uint8Array(response.authenticatorData),
          ),
          clientDataJSON: Array.from(new Uint8Array(response.clientDataJSON)),
          signature: Array.from(new Uint8Array(response.signature)),
          userHandle:
            response.userHandle === null
              ? null
              : Array.from(new Uint8Array(response.userHandle)),
        },
      };
    },
    {
      ...publicKey,
      challenge: bytes(publicKey.challenge),
      ...(publicKey.allowCredentials === undefined
        ? {}
        : {
            allowCredentials: publicKey.allowCredentials.map((descriptor) => ({
              ...descriptor,
              id: bytes(descriptor.id),
            })),
          }),
    },
  )) as SerializedBrowserCredential;
}

function bytes(value: BufferSource): number[] {
  return Array.from(
    value instanceof ArrayBuffer
      ? new Uint8Array(value)
      : new Uint8Array(value.buffer, value.byteOffset, value.byteLength),
  );
}

function reconstructCredential(value: SerializedBrowserCredential): Credential {
  const Attestation =
    globalThis.AuthenticatorAttestationResponse as unknown as new (
      value: Extract<
        SerializedBrowserCredential["response"],
        { kind: "attestation" }
      >,
    ) => AuthenticatorAttestationResponse;
  const Assertion =
    globalThis.AuthenticatorAssertionResponse as unknown as new (
      value: Extract<
        SerializedBrowserCredential["response"],
        { kind: "assertion" }
      >,
    ) => AuthenticatorAssertionResponse;
  const CredentialConstructor =
    globalThis.PublicKeyCredential as unknown as new (
      value: SerializedBrowserCredential,
      response: AuthenticatorResponse,
    ) => PublicKeyCredential;
  const response =
    value.response.kind === "attestation"
      ? new Attestation(value.response)
      : new Assertion(value.response);
  return new CredentialConstructor(value, response);
}

function installCredentialConstructors(): () => void {
  const names = [
    "PublicKeyCredential",
    "AuthenticatorAttestationResponse",
    "AuthenticatorAssertionResponse",
  ] as const;
  const previous = new Map(
    names.map((name) => [
      name,
      Object.getOwnPropertyDescriptor(globalThis, name),
    ]),
  );

  class TestAttestationResponse {
    readonly attestationObject: ArrayBuffer;
    readonly clientDataJSON: ArrayBuffer;
    readonly #transports: AuthenticatorTransport[];

    constructor(
      value: Extract<
        SerializedBrowserCredential["response"],
        { kind: "attestation" }
      >,
    ) {
      this.attestationObject = Uint8Array.from(value.attestationObject).buffer;
      this.clientDataJSON = Uint8Array.from(value.clientDataJSON).buffer;
      this.#transports = value.transports;
    }

    getTransports(): AuthenticatorTransport[] {
      return this.#transports;
    }
  }

  class TestAssertionResponse {
    readonly authenticatorData: ArrayBuffer;
    readonly clientDataJSON: ArrayBuffer;
    readonly signature: ArrayBuffer;
    readonly userHandle: ArrayBuffer | null;

    constructor(
      value: Extract<
        SerializedBrowserCredential["response"],
        { kind: "assertion" }
      >,
    ) {
      this.authenticatorData = Uint8Array.from(value.authenticatorData).buffer;
      this.clientDataJSON = Uint8Array.from(value.clientDataJSON).buffer;
      this.signature = Uint8Array.from(value.signature).buffer;
      this.userHandle =
        value.userHandle === null
          ? null
          : Uint8Array.from(value.userHandle).buffer;
    }
  }

  class TestPublicKeyCredential {
    readonly id: string;
    readonly rawId: ArrayBuffer;
    readonly type = "public-key";
    readonly authenticatorAttachment: string | null;
    readonly response: AuthenticatorResponse;
    readonly #extensions: AuthenticationExtensionsClientOutputs;

    constructor(
      value: SerializedBrowserCredential,
      response: AuthenticatorResponse,
    ) {
      this.id = value.id;
      this.rawId = Uint8Array.from(value.rawId).buffer;
      this.authenticatorAttachment = value.authenticatorAttachment;
      this.response = response;
      this.#extensions = value.clientExtensionResults;
    }

    getClientExtensionResults(): AuthenticationExtensionsClientOutputs {
      return this.#extensions;
    }
  }

  Object.defineProperties(globalThis, {
    PublicKeyCredential: {
      configurable: true,
      value: TestPublicKeyCredential,
    },
    AuthenticatorAttestationResponse: {
      configurable: true,
      value: TestAttestationResponse,
    },
    AuthenticatorAssertionResponse: {
      configurable: true,
      value: TestAssertionResponse,
    },
  });
  return () => {
    for (const name of names) {
      const descriptor = previous.get(name);
      if (descriptor === undefined) delete globalThis[name];
      else Object.defineProperty(globalThis, name, descriptor);
    }
  };
}

interface SessionFetch {
  fetch: typeof globalThis.fetch;
}

function createSessionFetch(relayOrigin: string, origin: string): SessionFetch {
  let cookie = "";
  return {
    fetch: async (input, init = {}) => {
      const target = new URL(
        typeof input === "string" || input instanceof URL ? input : input.url,
      );
      const headers = new Headers(init.headers);
      if (target.origin === new URL(relayOrigin).origin) {
        headers.set("Origin", origin);
        if (cookie !== "") headers.set("Cookie", cookie);
      }
      const response = await globalThis.fetch(input, {
        ...init,
        headers,
        redirect: init.redirect ?? "manual",
      });
      const setCookie = response.headers.get("set-cookie") ?? "";
      const match = /(?:^|,\s*)lapis_session=([^;]*)/u.exec(setCookie);
      if (match) cookie = match[1] ? `lapis_session=${match[1]}` : "";
      return response;
    },
  };
}

async function completeOAuth(
  loginUrl: string | undefined,
  session: SessionFetch,
  providerOrigin: string,
  returnTo: string,
): Promise<void> {
  if (!loginUrl) throw new Error("OAuth navigation was not captured");
  const begin = await session.fetch(loginUrl, { redirect: "manual" });
  expect(begin.status).toBe(302);
  const providerUrl = begin.headers.get("location");
  expect(providerUrl).toMatch(
    new RegExp(`^${escapeRegExp(providerOrigin)}/`, "u"),
  );
  const authorized = await fetch(providerUrl!, { redirect: "manual" });
  expect(authorized.status).toBe(302);
  const callbackUrl = authorized.headers.get("location");
  expect(callbackUrl).toBeTruthy();
  const callback = await session.fetch(callbackUrl!, { redirect: "manual" });
  expect(callback.status).toBe(302);
  expect(callback.headers.get("location")).toBe(returnTo);
  expect(callback.headers.get("location")).not.toMatch(
    /[?&](?:code|state|error)=/u,
  );
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}
