import { getPublicKey } from "nostr-tools/pure";
import { describe, expect, it } from "vitest";

import {
  RelayAuthClient,
  RelayAuthError,
  SecretKeyRegistrySigner,
} from "../auth/index.js";
import {
  createNip17GiftWraps,
  unwrapNip17GiftWrap,
} from "../community/index.js";
import { createWebSocketCommunityRelayFactory } from "../nostr/index.js";
import {
  createNip34ProjectForgeDataSource,
  createRepositoryTemplate,
} from "../projects/index.js";

const relayUrl = process.env.COMMUNITY_RELAY_URL;
const relayHttpUrl = process.env.COMMUNITY_RELAY_HTTP_URL;
const browserOrigin = process.env.COMMUNITY_AUTH_BROWSER_ORIGIN;
const fakeOAuthUrl = process.env.COMMUNITY_FAKE_OAUTH_URL;

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
      await client.signOut();
      await expect(client.getSession()).rejects.toMatchObject({ status: 401 });
    }, 90_000);
  });
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
