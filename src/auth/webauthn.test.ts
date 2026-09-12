import { describe, expect, it, vi } from "vitest";

import {
  decodeBase64Url,
  decodePasskeyCreationOptions,
  decodePasskeyRequestOptions,
  encodeBase64Url,
  serializePasskeyCredential,
} from "./webauthn.js";

describe("browser WebAuthn conversion", () => {
  it("decodes creation and assertion binary fields", () => {
    const creation = decodePasskeyCreationOptions({
      publicKey: {
        challenge: "AQID",
        rp: { id: "community.example", name: "Lapis" },
        user: {
          id: "BAUG",
          name: "pubkey",
          displayName: "Lapis account",
        },
        pubKeyCredParams: [{ type: "public-key", alg: -7 }],
        excludeCredentials: [{ type: "public-key", id: "BwgJ" }],
      },
    });
    expect(Array.from(creation.publicKey!.challenge as Uint8Array)).toEqual([
      1, 2, 3,
    ]);
    expect(Array.from(creation.publicKey!.user.id as Uint8Array)).toEqual([
      4, 5, 6,
    ]);
    expect(
      Array.from(creation.publicKey!.excludeCredentials![0]!.id as Uint8Array),
    ).toEqual([7, 8, 9]);

    const request = decodePasskeyRequestOptions({
      publicKey: {
        challenge: "AQID",
        allowCredentials: [{ type: "public-key", id: "BAUG" }],
      },
    });
    expect(
      Array.from(request.publicKey!.allowCredentials![0]!.id as Uint8Array),
    ).toEqual([4, 5, 6]);
  });

  it("round trips URL-safe binary encoding", () => {
    const value = new Uint8Array([251, 255, 0, 16]);
    expect(Array.from(decodeBase64Url(encodeBase64Url(value)))).toEqual(
      Array.from(value),
    );
  });

  it("serializes an attestation without leaking browser objects", () => {
    class Attestation {
      attestationObject = new Uint8Array([1, 2]).buffer;
      clientDataJSON = new Uint8Array([3, 4]).buffer;
      getTransports = () => ["internal"];
    }
    class Credential {
      id = "credential-a";
      rawId = new Uint8Array([5, 6]).buffer;
      type = "public-key";
      authenticatorAttachment = "platform";
      response = new Attestation();
      getClientExtensionResults = () => ({});
    }
    vi.stubGlobal("PublicKeyCredential", Credential);
    vi.stubGlobal("AuthenticatorAttestationResponse", Attestation);
    vi.stubGlobal("AuthenticatorAssertionResponse", class {});

    expect(
      serializePasskeyCredential(new Credential() as unknown as Credential),
    ).toEqual({
      id: "credential-a",
      rawId: "BQY",
      type: "public-key",
      authenticatorAttachment: "platform",
      clientExtensionResults: {},
      response: {
        attestationObject: "AQI",
        clientDataJSON: "AwQ",
        transports: ["internal"],
      },
    });
    vi.unstubAllGlobals();
  });
});
