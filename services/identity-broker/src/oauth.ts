import { createHash } from "node:crypto";

import type {
  IdentityProvider,
  OAuthAuthorizationRequest,
  OAuthCallbackRequest,
  OAuthProviderAdapter,
} from "./types.js";

export interface GoogleTokenClient {
  exchange(request: {
    code: string;
    codeVerifier: string;
    redirectUri: string;
  }): Promise<{ idToken: string }>;
}

export interface GoogleIdTokenVerifier {
  verify(request: {
    idToken: string;
    audience: string;
    nonce: string;
    allowedIssuers: readonly string[];
  }): Promise<{ subject: string }>;
}

export class GoogleOAuthAdapter implements OAuthProviderAdapter {
  readonly provider = "google" as const;
  readonly #clientId: string;
  readonly #tokens: GoogleTokenClient;
  readonly #idTokens: GoogleIdTokenVerifier;

  constructor(options: {
    clientId: string;
    tokens: GoogleTokenClient;
    idTokens: GoogleIdTokenVerifier;
  }) {
    this.#clientId = options.clientId;
    this.#tokens = options.tokens;
    this.#idTokens = options.idTokens;
  }

  createAuthorizationUrl(request: OAuthAuthorizationRequest): URL {
    const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    url.search = new URLSearchParams({
      client_id: this.#clientId,
      code_challenge: request.codeChallenge,
      code_challenge_method: "S256",
      nonce: request.nonce,
      redirect_uri: request.redirectUri,
      response_type: "code",
      scope: "openid",
      state: request.state,
    }).toString();
    return url;
  }

  async resolveSubject(request: OAuthCallbackRequest): Promise<string> {
    const token = await this.#tokens.exchange({
      code: request.code,
      codeVerifier: request.codeVerifier,
      redirectUri: request.redirectUri,
    });
    const verified = await this.#idTokens.verify({
      idToken: token.idToken,
      audience: this.#clientId,
      nonce: request.nonce,
      allowedIssuers: ["https://accounts.google.com", "accounts.google.com"],
    });
    return verified.subject;
  }
}

export interface GithubTokenClient {
  exchange(request: {
    code: string;
    codeVerifier: string;
    redirectUri: string;
  }): Promise<{ accessToken: string }>;
}

export interface GithubUserClient {
  resolve(accessToken: string): Promise<{ numericId: number }>;
}

export class GithubOAuthAdapter implements OAuthProviderAdapter {
  readonly provider = "github" as const;
  readonly #clientId: string;
  readonly #tokens: GithubTokenClient;
  readonly #users: GithubUserClient;

  constructor(options: {
    clientId: string;
    tokens: GithubTokenClient;
    users: GithubUserClient;
  }) {
    this.#clientId = options.clientId;
    this.#tokens = options.tokens;
    this.#users = options.users;
  }

  createAuthorizationUrl(request: OAuthAuthorizationRequest): URL {
    const url = new URL("https://github.com/login/oauth/authorize");
    url.search = new URLSearchParams({
      client_id: this.#clientId,
      code_challenge: request.codeChallenge,
      code_challenge_method: "S256",
      redirect_uri: request.redirectUri,
      scope: "read:user",
      state: request.state,
    }).toString();
    return url;
  }

  async resolveSubject(request: OAuthCallbackRequest): Promise<string> {
    const token = await this.#tokens.exchange({
      code: request.code,
      codeVerifier: request.codeVerifier,
      redirectUri: request.redirectUri,
    });
    const user = await this.#users.resolve(token.accessToken);
    if (!Number.isSafeInteger(user.numericId) || user.numericId <= 0) {
      throw new Error("GitHub returned an invalid stable numeric user id");
    }
    return String(user.numericId);
  }
}

export function pkceChallenge(verifier: string): string {
  return createHash("sha256").update(verifier).digest("base64url");
}

export function providerLabel(provider: IdentityProvider): string {
  return provider === "google" ? "Google" : "GitHub";
}
