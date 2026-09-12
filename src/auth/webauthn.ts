import { z } from "zod";

export interface CommunityCredentialsContainer {
  create(options?: CredentialCreationOptions): Promise<Credential | null>;
  get(options?: CredentialRequestOptions): Promise<Credential | null>;
}

const descriptorSchema = z.object({
  id: z.string().min(1),
  type: z.literal("public-key"),
  transports: z.array(z.string()).optional(),
});

const creationOptionsSchema = z.object({
  publicKey: z
    .object({
      challenge: z.string().min(1),
      user: z.object({ id: z.string().min(1) }).passthrough(),
      excludeCredentials: z.array(descriptorSchema).optional(),
    })
    .passthrough(),
});

const requestOptionsSchema = z.object({
  publicKey: z
    .object({
      challenge: z.string().min(1),
      allowCredentials: z.array(descriptorSchema).optional(),
    })
    .passthrough(),
});

export function decodePasskeyCreationOptions(
  value: unknown,
): CredentialCreationOptions {
  const parsed = creationOptionsSchema.parse(value);
  return {
    publicKey: {
      ...parsed.publicKey,
      challenge: decodeBase64Url(parsed.publicKey.challenge),
      user: {
        ...parsed.publicKey.user,
        id: decodeBase64Url(parsed.publicKey.user.id),
      },
      excludeCredentials:
        parsed.publicKey.excludeCredentials?.map(decodeDescriptor),
    } as unknown as PublicKeyCredentialCreationOptions,
  };
}

export function decodePasskeyRequestOptions(
  value: unknown,
): CredentialRequestOptions {
  const parsed = requestOptionsSchema.parse(value);
  return {
    publicKey: {
      ...parsed.publicKey,
      challenge: decodeBase64Url(parsed.publicKey.challenge),
      allowCredentials:
        parsed.publicKey.allowCredentials?.map(decodeDescriptor),
    } as PublicKeyCredentialRequestOptions,
  };
}

function decodeDescriptor(
  descriptor: z.infer<typeof descriptorSchema>,
): PublicKeyCredentialDescriptor {
  return {
    type: descriptor.type,
    id: decodeBase64Url(descriptor.id),
    ...(descriptor.transports === undefined
      ? {}
      : {
          transports: descriptor.transports as AuthenticatorTransport[],
        }),
  };
}

export function serializePasskeyCredential(
  value: Credential | null,
): Record<string, unknown> {
  if (!(value instanceof PublicKeyCredential)) {
    throw new Error("The passkey request was cancelled");
  }
  const response = value.response;
  const base = {
    id: value.id,
    rawId: encodeBase64Url(new Uint8Array(value.rawId)),
    type: value.type,
    authenticatorAttachment: value.authenticatorAttachment,
    clientExtensionResults: value.getClientExtensionResults(),
  };
  if (response instanceof AuthenticatorAttestationResponse) {
    return {
      ...base,
      response: {
        attestationObject: encodeBase64Url(
          new Uint8Array(response.attestationObject),
        ),
        clientDataJSON: encodeBase64Url(
          new Uint8Array(response.clientDataJSON),
        ),
        transports: response.getTransports(),
      },
    };
  }
  if (response instanceof AuthenticatorAssertionResponse) {
    return {
      ...base,
      response: {
        authenticatorData: encodeBase64Url(
          new Uint8Array(response.authenticatorData),
        ),
        clientDataJSON: encodeBase64Url(
          new Uint8Array(response.clientDataJSON),
        ),
        signature: encodeBase64Url(new Uint8Array(response.signature)),
        userHandle:
          response.userHandle === null
            ? null
            : encodeBase64Url(new Uint8Array(response.userHandle)),
      },
    };
  }
  throw new Error("The browser returned an unsupported passkey response");
}

export function browserCredentials(): CommunityCredentialsContainer {
  if (
    typeof globalThis.PublicKeyCredential !== "function" ||
    globalThis.navigator?.credentials === undefined
  ) {
    throw new Error("Passkeys are unavailable in this browser");
  }
  return globalThis.navigator.credentials;
}

export function decodeBase64Url(value: string): Uint8Array {
  const normalized = value.replaceAll("-", "+").replaceAll("_", "/");
  const padded = normalized.padEnd(
    normalized.length + ((4 - (normalized.length % 4)) % 4),
    "=",
  );
  const binary = globalThis.atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

export function encodeBase64Url(value: Uint8Array): string {
  let binary = "";
  for (const byte of value) binary += String.fromCharCode(byte);
  return globalThis
    .btoa(binary)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/u, "");
}
