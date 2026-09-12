import { createHash, generateKeyPairSync, randomUUID, sign } from "node:crypto";
import http from "node:http";

const port = Number.parseInt(process.env.PORT ?? "8091", 10);
const publicOrigin = requiredOrigin("PUBLIC_ORIGIN");
const relayOrigin = requiredOrigin("RELAY_PUBLIC_ORIGIN");
const issuer = `${publicOrigin}/google`;
const { privateKey, publicKey } = generateKeyPairSync("rsa", {
  modulusLength: 2048,
});
const publicJwk = publicKey.export({ format: "jwk" });
const codes = new Map();
let githubIdentity = {
  id: 1002,
  login: "community-tester",
  name: "Community Tester",
  email: "community@example.test",
};

function requiredOrigin(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  const parsed = new URL(value);
  if (
    parsed.origin !== value ||
    !["http:", "https:"].includes(parsed.protocol)
  ) {
    throw new Error(`${name} must be an HTTP origin`);
  }
  return value;
}

function sendJson(response, status, value) {
  const body = JSON.stringify(value);
  response.writeHead(status, {
    "Content-Type": "application/json",
    "Content-Length": Buffer.byteLength(body),
    "Cache-Control": "no-store",
  });
  response.end(body);
}

function sendOAuthError(response) {
  sendJson(response, 400, { error: "invalid_request" });
}

function base64url(value) {
  return Buffer.from(value).toString("base64url");
}

function jwt(payload) {
  const header = base64url(
    JSON.stringify({ alg: "RS256", kid: "community-test", typ: "JWT" }),
  );
  const body = base64url(JSON.stringify(payload));
  const input = `${header}.${body}`;
  return `${input}.${sign("RSA-SHA256", Buffer.from(input), privateKey).toString("base64url")}`;
}

function callbackFor(provider) {
  return `${relayOrigin}/api/auth/callback/${provider}`;
}

function validAuthorizationRequest(url, provider) {
  return (
    url.searchParams.get("response_type") === "code" &&
    url.searchParams.get("client_id") === `community-${provider}` &&
    url.searchParams.get("redirect_uri") === callbackFor(provider) &&
    url.searchParams.get("state") !== null &&
    url.searchParams.get("code_challenge_method") === "S256" &&
    url.searchParams.get("code_challenge") !== null &&
    (provider !== "google" || url.searchParams.get("nonce") !== null)
  );
}

function authorize(request, response, url, provider) {
  if (!validAuthorizationRequest(url, provider))
    return sendOAuthError(response);
  const code = `${provider}-${randomUUID()}`;
  codes.set(code, {
    provider,
    challenge: url.searchParams.get("code_challenge"),
    nonce: url.searchParams.get("nonce"),
  });
  const callback = new URL(callbackFor(provider));
  callback.searchParams.set("code", code);
  callback.searchParams.set("state", url.searchParams.get("state"));
  response.writeHead(302, {
    Location: callback.toString(),
    "Cache-Control": "no-store",
  });
  response.end();
}

async function readForm(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > 64 * 1024) throw new Error("request too large");
    chunks.push(chunk);
  }
  return new URLSearchParams(Buffer.concat(chunks).toString("utf8"));
}

function clientCredentials(request, form) {
  let clientId = form.get("client_id") ?? "";
  let clientSecret = form.get("client_secret") ?? "";
  const authorization = request.headers.authorization ?? "";
  if (authorization.startsWith("Basic ")) {
    const decoded = Buffer.from(authorization.slice(6), "base64").toString(
      "utf8",
    );
    [clientId, clientSecret] = decoded.split(":", 2).map(decodeURIComponent);
  }
  return { clientId, clientSecret };
}

async function exchange(request, response, provider) {
  let form;
  try {
    form = await readForm(request);
  } catch {
    return sendOAuthError(response);
  }
  const code = form.get("code") ?? "";
  const flow = codes.get(code);
  const { clientId, clientSecret } = clientCredentials(request, form);
  const verifier = form.get("code_verifier") ?? "";
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  if (
    form.get("grant_type") !== "authorization_code" ||
    form.get("redirect_uri") !== callbackFor(provider) ||
    clientId !== `community-${provider}` ||
    clientSecret === "" ||
    flow?.provider !== provider ||
    challenge !== flow.challenge
  ) {
    return sendOAuthError(response);
  }
  codes.delete(code);
  const token = {
    access_token: `${provider}-access-token`,
    token_type: "Bearer",
    expires_in: 3600,
  };
  if (provider === "google") {
    const now = Math.floor(Date.now() / 1000);
    token.id_token = jwt({
      iss: issuer,
      aud: "community-google",
      sub: "google-user-1001",
      nonce: flow.nonce,
      email: "community@example.test",
      email_verified: true,
      name: "Community Tester",
      iat: now,
      exp: now + 3600,
    });
  }
  sendJson(response, 200, token);
}

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url ?? "/", publicOrigin);
  if (request.method === "GET" && url.pathname === "/health") {
    response.writeHead(204, { "Cache-Control": "no-store" });
    return response.end();
  }
  if (request.method === "GET" && url.pathname === "/github/authorize") {
    return authorize(request, response, url, "github");
  }
  if (request.method === "POST" && url.pathname === "/github/token") {
    return await exchange(request, response, "github");
  }
  if (request.method === "GET" && url.pathname === "/github/user") {
    if (request.headers.authorization !== "Bearer github-access-token") {
      return sendJson(response, 401, { error: "unauthorized" });
    }
    return sendJson(response, 200, githubIdentity);
  }
  if (
    request.method === "POST" &&
    url.pathname === "/test/github-identity" &&
    url.searchParams.get("variant") === "keytr"
  ) {
    githubIdentity = {
      id: 2002,
      login: "keytr-tester",
      name: "Keytr Tester",
      email: "keytr@example.test",
    };
    return sendJson(response, 200, githubIdentity);
  }
  if (
    request.method === "GET" &&
    url.pathname === "/google/.well-known/openid-configuration"
  ) {
    return sendJson(response, 200, {
      issuer,
      authorization_endpoint: `${issuer}/authorize`,
      token_endpoint: `${issuer}/token`,
      jwks_uri: `${issuer}/jwks`,
      response_types_supported: ["code"],
      subject_types_supported: ["public"],
      id_token_signing_alg_values_supported: ["RS256"],
    });
  }
  if (request.method === "GET" && url.pathname === "/google/jwks") {
    return sendJson(response, 200, {
      keys: [{ ...publicJwk, kid: "community-test", use: "sig", alg: "RS256" }],
    });
  }
  if (request.method === "GET" && url.pathname === "/google/authorize") {
    return authorize(request, response, url, "google");
  }
  if (request.method === "POST" && url.pathname === "/google/token") {
    return await exchange(request, response, "google");
  }
  sendJson(response, 404, { error: "not_found" });
});

server.listen(port, "0.0.0.0", () => {
  process.stdout.write(`Fake OAuth provider listening on ${port}\n`);
});
