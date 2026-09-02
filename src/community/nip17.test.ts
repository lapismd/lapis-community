import { describe, expect, it } from "vitest";

import { SecretKeyRegistrySigner } from "../auth/index.js";
import { createNip17GiftWraps, unwrapNip17GiftWrap } from "./nip17.js";

describe("NIP-17 direct messages", () => {
  it("creates recipient and sender gift wraps that reveal the same rumor", async () => {
    const sender = new SecretKeyRegistrySigner(new Uint8Array(32).fill(61));
    const recipient = new SecretKeyRegistrySigner(new Uint8Array(32).fill(62));
    const recipientPubkey = await recipient.getPublicKey();
    const senderPubkey = await sender.getPublicKey();
    const wraps = await createNip17GiftWraps({
      identity: sender,
      recipients: [recipientPubkey],
      content: "private hello",
      createdAt: 1_700_000_000,
      randomOffsetSeconds: () => 10,
    });
    expect(wraps).toHaveLength(2);
    const recipientWrap = wraps.find((wrap) =>
      wrap.tags.some((tag) => tag[0] === "p" && tag[1] === recipientPubkey),
    )!;
    const senderWrap = wraps.find((wrap) =>
      wrap.tags.some((tag) => tag[0] === "p" && tag[1] === senderPubkey),
    )!;

    const received = await unwrapNip17GiftWrap(recipient, recipientWrap);
    const sent = await unwrapNip17GiftWrap(sender, senderWrap);
    expect(received).toMatchObject({
      id: sent.id,
      pubkey: senderPubkey,
      content: "private hello",
    });
  });

  it("rejects a wrap addressed to another identity", async () => {
    const sender = new SecretKeyRegistrySigner(new Uint8Array(32).fill(63));
    const recipient = new SecretKeyRegistrySigner(new Uint8Array(32).fill(64));
    const stranger = new SecretKeyRegistrySigner(new Uint8Array(32).fill(65));
    const wraps = await createNip17GiftWraps({
      identity: sender,
      recipients: [await recipient.getPublicKey()],
      content: "private",
      createdAt: 1_700_000_000,
      randomOffsetSeconds: () => 0,
    });
    await expect(unwrapNip17GiftWrap(stranger, wraps[0]!)).rejects.toThrow(
      "another recipient",
    );
  });
});
