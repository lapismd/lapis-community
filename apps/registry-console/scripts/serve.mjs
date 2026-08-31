import { readFile } from "node:fs/promises";
import { createServer } from "node:http";

const port = Number(process.env.PORT ?? 4173);
const host = process.env.HOST ?? "127.0.0.1";

function required(name) {
  const value = process.env[name];
  if (value === undefined || value.trim() === "") {
    throw new Error(`${name} is required`);
  }
  return value.trim();
}

function list(name) {
  return required(name)
    .split(",")
    .map((value) => value.trim())
    .filter((value) => value !== "");
}

function optionalList(name) {
  return (process.env[name] ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter((value) => value !== "");
}

function integer(name, fallback) {
  const value = Number(process.env[name] ?? fallback);
  if (!Number.isInteger(value) || value < 0 || value > 65_535) {
    throw new Error(`${name} must be a Nostr kind integer`);
  }
  return value;
}

function consoleConfig() {
  const testKinds = process.env.REGISTRY_USE_TEST_KINDS === "true";
  const workflow = testKinds
    ? {
        approval: 64_000,
        revocation: 64_001,
        snapshot: 64_002,
        moderationDecision: 64_003,
      }
    : {
        approval: integer("REGISTRY_APPROVAL_KIND"),
        revocation: integer("REGISTRY_REVOCATION_KIND"),
        snapshot: integer("REGISTRY_SNAPSHOT_KIND"),
        moderationDecision: integer("REGISTRY_MODERATION_DECISION_KIND"),
      };
  const publisherJson = process.env.REGISTRY_PUBLISHERS_JSON?.trim();
  const publishers = JSON.parse(
    publisherJson === undefined || publisherJson === "" ? "{}" : publisherJson,
  );
  if (
    publishers === null ||
    Array.isArray(publishers) ||
    typeof publishers !== "object"
  ) {
    throw new Error("REGISTRY_PUBLISHERS_JSON must be an object");
  }
  return {
    officialRelays: list("REGISTRY_OFFICIAL_RELAYS"),
    communityRelays: list("REGISTRY_COMMUNITY_RELAYS"),
    publishQuorum: Number(process.env.REGISTRY_PUBLISH_QUORUM ?? "1"),
    kinds: {
      softwareApplication: 32_267,
      releaseArtifactSet: 30_063,
      assessmentLabel: 1_985,
      moderationReport: 1_984,
      fileMetadata: 1_063,
      comment: 1_111,
      ...workflow,
    },
    communityKinds: {
      rating: testKinds ? 64_006 : integer("REGISTRY_RATING_KIND"),
      comment: 1_111,
      report: 1_984,
      followList: 3,
      appCurationSet: 30_267,
      softwareApplication: 32_267,
    },
    securityKinds: {
      advisory: testKinds ? 64_004 : integer("REGISTRY_SECURITY_ADVISORY_KIND"),
      disposition: testKinds
        ? 64_005
        : integer("REGISTRY_SECURITY_DISPOSITION_KIND"),
    },
    authorities: {
      assessorPubkeys: optionalList("REGISTRY_ASSESSOR_PUBKEYS"),
      curatorPubkeys: optionalList("REGISTRY_CURATOR_PUBKEYS"),
      moderatorPubkeys: optionalList("REGISTRY_MODERATOR_PUBKEYS"),
      snapshotSignerPubkeys: optionalList("REGISTRY_SNAPSHOT_SIGNER_PUBKEYS"),
      registryOperatorPubkeys: optionalList("REGISTRY_OPERATOR_PUBKEYS"),
      ...(Object.keys(publishers).length === 0
        ? {}
        : { publisherPubkeysByPlugin: publishers }),
    },
    securityAuthorities: {
      advisoryPubkeys: optionalList("REGISTRY_SECURITY_ADVISORY_PUBKEYS"),
      dispositionPubkeys: optionalList("REGISTRY_SECURITY_DISPOSITION_PUBKEYS"),
    },
  };
}

const publicConfig = JSON.stringify(consoleConfig());
const server = createServer(async (request, response) => {
  const pathname = new URL(request.url ?? "/", "http://localhost").pathname;
  if (pathname === "/config.json") {
    response.writeHead(200, {
      "cache-control": "no-store",
      "content-type": "application/json; charset=utf-8",
      "x-content-type-options": "nosniff",
    });
    response.end(publicConfig);
    return;
  }
  const file = pathname === "/" ? "index.html" : pathname.slice(1);
  if (!/^(?:index\.html|styles\.css|assets\/[a-z0-9-]+\.js)$/u.test(file)) {
    response.writeHead(404).end("Not found");
    return;
  }
  try {
    const body = await readFile(new URL(`../dist/${file}`, import.meta.url));
    const contentType = file.endsWith(".js")
      ? "text/javascript; charset=utf-8"
      : file.endsWith(".css")
        ? "text/css; charset=utf-8"
        : "text/html; charset=utf-8";
    response.writeHead(200, {
      "cache-control": "no-store",
      "content-type": contentType,
      "x-content-type-options": "nosniff",
    });
    response.end(body);
  } catch {
    response.writeHead(404).end("Not found");
  }
});

server.listen(port, host, () => {
  console.log(`Registry console listening on http://${host}:${port}`);
});
