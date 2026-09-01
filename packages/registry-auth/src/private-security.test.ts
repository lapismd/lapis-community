import { v2 as nip44 } from "nostr-tools/nip44";
import {
  finalizeEvent,
  generateSecretKey,
  getPublicKey,
} from "nostr-tools/pure";
import { describe, expect, it } from "vitest";

import {
  createPrivateSecurityGiftWrap,
  decryptPrivateAttachment,
  encryptPrivateAttachment,
  Nip07RegistrySigner,
  unwrapPrivateSecurityGiftWrap,
} from "./index.js";
import type { Nip07Provider } from "./index.js";

function privateSigner(secret: Uint8Array): Nip07RegistrySigner {
  const provider: Nip07Provider = {
    getPublicKey: async () => getPublicKey(secret),
    signEvent: async (template) => finalizeEvent(template, secret),
    nip44: {
      encrypt: async (pubkey, plaintext) =>
        nip44.encrypt(
          plaintext,
          nip44.utils.getConversationKey(secret, pubkey),
        ),
      decrypt: async (pubkey, ciphertext) =>
        nip44.decrypt(
          ciphertext,
          nip44.utils.getConversationKey(secret, pubkey),
        ),
    },
  };
  return new Nip07RegistrySigner(provider);
}

describe("private security gift wraps", () => {
  it("uploads only client-encrypted attachment bytes", async () => {
    const plaintext = new TextEncoder().encode("private reproduction details");
    let uploaded: Uint8Array = new Uint8Array();
    let randomCall = 0;
    const descriptor = await encryptPrivateAttachment({
      bytes: plaintext,
      name: "reproduction.txt",
      mediaType: "text/plain",
      randomBytes: (length) => new Uint8Array(length).fill(++randomCall),
      upload: async (encryptedBytes) => {
        uploaded = encryptedBytes;
        return "https://blossom.example/encrypted-blob";
      },
    });

    expect(uploaded).not.toEqual(plaintext);
    expect(new TextDecoder().decode(uploaded)).not.toContain("reproduction");
    expect(decryptPrivateAttachment(uploaded, descriptor)).toEqual(plaintext);
    const tampered = uploaded.slice();
    tampered[0] = tampered[0]! ^ 1;
    expect(() => decryptPrivateAttachment(tampered, descriptor)).toThrow(
      "ciphertext hash",
    );
  });

  it("encrypts reports and replies with no sensitive public metadata", async () => {
    const reporter = privateSigner(generateSecretKey());
    const security = privateSigner(generateSecretKey());
    const stranger = privateSigner(generateSecretKey());
    const securityPubkey = await security.getPublicKey();

    const report = await createPrivateSecurityGiftWrap({
      signer: reporter,
      recipientPubkey: securityPubkey,
      createdAt: 1_800_000_000,
      random: () => 0.5,
      payload: {
        schema: "lapis.registry.private-security-message/1",
        conversationId: "private-conversation-1",
        messageId: "report-1",
        type: "report",
        body: "AI plugin 2.0.0 has a critical token disclosure.",
      },
    });

    expect(report.wrap.kind).toBe(1059);
    expect(report.wrap.tags).toEqual([["p", securityPubkey]]);
    expect(JSON.stringify(report.wrap)).not.toContain("AI plugin");
    await expect(
      unwrapPrivateSecurityGiftWrap({ signer: stranger, wrap: report.wrap }),
    ).rejects.toThrow();

    const openedReport = await unwrapPrivateSecurityGiftWrap({
      signer: security,
      wrap: report.wrap,
    });
    expect(openedReport.payload).toEqual(report.payload);
    expect(openedReport.senderPubkey).toBe(await reporter.getPublicKey());

    const reply = await createPrivateSecurityGiftWrap({
      signer: security,
      recipientPubkey: await reporter.getPublicKey(),
      createdAt: 1_800_000_060,
      random: () => 0.25,
      payload: {
        schema: "lapis.registry.private-security-message/1",
        conversationId: report.payload.conversationId,
        messageId: "reply-1",
        type: "reply",
        body: "Received. We are reproducing privately.",
        replyToEventId: report.wrap.id,
      },
    });
    await expect(
      unwrapPrivateSecurityGiftWrap({ signer: reporter, wrap: reply.wrap }),
    ).resolves.toMatchObject({
      payload: reply.payload,
      senderPubkey: securityPubkey,
    });
  });
});
