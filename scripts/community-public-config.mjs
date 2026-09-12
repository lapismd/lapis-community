import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export const publicKeys = [
  "VITE_COMMUNITY_PUBLIC_URL",
  "VITE_COMMUNITY_LIVE_RELAY_URL",
  "VITE_COMMUNITY_RELAY_AUTH_URL",
  "VITE_COMMUNITY_KEYTR_RELAYS",
  "VITE_COMMUNITY_KEYTR_GATEWAYS",
  "VITE_REGISTRY_CURATOR_PUBKEYS",
  "VITE_REGISTRY_PUBLISHER_PUBKEYS",
  "VITE_REGISTRY_AUTHORITY_EPOCH",
];

export function publicConfigurationPath(env = process.env) {
  return path.join(
    env.LAPIS_COMMUNITY_DIR || path.join(os.homedir(), ".lapis/community"),
    "public.env",
  );
}

export function readCommunityPublicConfiguration(env = process.env) {
  const filename = publicConfigurationPath(env);
  /** @type {Record<string, string>} */
  const values = {};
  if (fs.existsSync(filename)) {
    for (const line of fs.readFileSync(filename, "utf8").split(/\r?\n/u)) {
      const separator = line.indexOf("=");
      const key = line.slice(0, separator);
      if (separator < 1 || !publicKeys.includes(key)) continue;
      let value = line.slice(separator + 1).trim();
      if (
        (value.startsWith("'") && value.endsWith("'")) ||
        (value.startsWith('"') && value.endsWith('"'))
      )
        value = value.slice(1, -1);
      values[key] = value;
    }
  }
  for (const key of publicKeys) {
    if (env[key] !== undefined) values[key] = env[key];
  }
  return values;
}
