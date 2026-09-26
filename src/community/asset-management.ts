import { z } from "zod";

import { encodeNostrHttpAuthorization } from "../nostr/http-authorization.js";
import { nostrEventSchema } from "../protocol/index.js";
import type { CommunityIdentity } from "./contracts.js";
import { relayHttpBaseUrl } from "./profile-image-upload.js";

const hex64 = z.string().regex(/^[0-9a-f]{64}$/u);
const pageLimit = z.number().int().min(1).max(500);
const assetLimit = pageLimit.max(1_000);
const pageOptionsSchema = z
  .object({ limit: pageLimit.optional(), cursor: z.string().min(1).optional() })
  .strict();
const assetPageOptionsSchema = pageOptionsSchema.extend({
  limit: assetLimit.optional(),
  cursor: hex64.optional(),
});
const assetPurposeSchema = z.enum(["avatar", "emoji", "plugin"]);

const assetSchema = z
  .object({
    url: z.string().url(),
    sha256: hex64,
    size: z.number().int().nonnegative(),
    type: z.string().min(1),
    uploaded: z.number().int().nonnegative(),
    nip94: z.array(z.array(z.string())),
    lapis: z.record(z.string(), z.array(z.string())).optional(),
  })
  .strict();
const assetListSchema = z.array(assetSchema);

const historyActionSchema = z.enum([
  "uploaded",
  "reference-added",
  "reference-removed",
  "delete-blocked",
  "deleted",
]);
const historyItemSchema = z
  .object({
    cursor: z.string().regex(/^[0-9]+:[1-9][0-9]*$/u),
    owner: hex64,
    sha256: hex64,
    action: historyActionSchema,
    reference_type: z.string().min(1).optional(),
    reference_key: z.string().min(1).optional(),
    slot: z.string().min(1).optional(),
    source_event_id: hex64.optional(),
    occurred_at: z.number().int().nonnegative(),
  })
  .strict();
const historyPageSchema = z
  .object({
    items: z.array(historyItemSchema),
    next_cursor: z
      .string()
      .regex(/^[0-9]+:[1-9][0-9]*$/u)
      .optional(),
  })
  .strict();

const reportSchema = z
  .object({
    event: nostrEventSchema,
    status: z.string().min(1),
    reviewed_by: hex64.optional(),
    reviewed_at: z.number().int().nonnegative().optional(),
  })
  .strict();
const reportListSchema = z.array(reportSchema);

export type CommunityAssetPurpose = z.infer<typeof assetPurposeSchema>;
export type CommunityAsset = z.infer<typeof assetSchema>;
export type CommunityAssetHistoryItem = z.infer<typeof historyItemSchema>;
export type CommunityAssetReport = z.infer<typeof reportSchema>;

export interface CommunityAssetPage<T> {
  items: T[];
  nextCursor?: string;
}

export interface CommunityAssetManagementOptions {
  relayUrl: string;
  identity: CommunityIdentity;
  fetch?: typeof globalThis.fetch;
  now?: () => number;
}

export interface CommunityAssetManagement {
  listAssets(
    purpose: CommunityAssetPurpose,
    options?: { limit?: number; cursor?: string },
  ): Promise<CommunityAssetPage<CommunityAsset>>;
  listHistory(options?: {
    limit?: number;
    cursor?: string;
  }): Promise<CommunityAssetPage<CommunityAssetHistoryItem>>;
  listReports(options?: {
    limit?: number;
    cursor?: string;
  }): Promise<CommunityAssetPage<CommunityAssetReport>>;
  deleteAsset(sha256: string): Promise<void>;
}

export class CommunityAssetRequestError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "CommunityAssetRequestError";
    this.status = status;
  }
}

export function createCommunityAssetManagement(
  options: CommunityAssetManagementOptions,
): CommunityAssetManagement {
  const base = relayHttpBaseUrl(options.relayUrl);
  const fetcher = (options.fetch ?? globalThis.fetch).bind(globalThis);
  const now = (): number => Math.floor(options.now?.() ?? Date.now() / 1_000);

  async function authorization(
    action: "list" | "delete",
    content: string,
    sha256?: string,
  ): Promise<string> {
    const createdAt = now();
    const event = await options.identity.signEvent({
      kind: 24_242,
      created_at: createdAt,
      content,
      tags: [
        ["t", action],
        ...(sha256 ? [["x", sha256]] : []),
        ["expiration", String(createdAt + 300)],
        ["server", base.host],
      ],
    });
    return encodeNostrHttpAuthorization(event);
  }

  async function request(
    url: URL,
    content: string,
    init?: RequestInit,
    sha256?: string,
  ): Promise<Response> {
    const action = init?.method === "DELETE" ? "delete" : "list";
    const response = await fetcher(url, {
      ...init,
      headers: {
        ...init?.headers,
        Authorization: await authorization(action, content, sha256),
      },
    });
    if (!response.ok) {
      const fallback = `Asset request failed with ${response.status}`;
      let message = fallback;
      try {
        message = (await response.text()).trim() || fallback;
      } catch {
        // Keep the status-based fallback if the response body is unreadable.
      }
      throw new CommunityAssetRequestError(response.status, message);
    }
    return response;
  }

  return {
    async listAssets(purpose, input = {}) {
      const selectedPurpose = assetPurposeSchema.parse(purpose);
      const page = assetPageOptionsSchema.parse(input);
      const owner = hex64.parse(await options.identity.getPublicKey());
      const url = new URL(`/list/${owner}`, base);
      appendPage(url, page);
      url.searchParams.set("tag.purpose", selectedPurpose);
      const response = await request(url, "List Lapis assets");
      const items = parsePayload(
        assetListSchema,
        await response.json(),
        "asset list",
      );
      return {
        items,
        ...(items.length === (page.limit ?? 100) && items.at(-1)
          ? { nextCursor: items.at(-1)!.sha256 }
          : {}),
      };
    },

    async listHistory(input = {}) {
      const page = pageOptionsSchema.parse(input);
      const url = new URL("/api/assets/history", base);
      appendPage(url, page);
      const response = await request(url, "Read Lapis asset history");
      const payload = parsePayload(
        historyPageSchema,
        await response.json(),
        "asset history",
      );
      return {
        items: payload.items,
        ...(payload.next_cursor ? { nextCursor: payload.next_cursor } : {}),
      };
    },

    async listReports(input = {}) {
      const page = pageOptionsSchema
        .extend({ cursor: hex64.optional() })
        .parse(input);
      const url = new URL("/api/assets/reports", base);
      appendPage(url, page);
      const response = await request(url, "Review Lapis asset reports");
      const items = parsePayload(
        reportListSchema,
        await response.json(),
        "asset reports",
      );
      return {
        items,
        ...(items.length === (page.limit ?? 100) && items.at(-1)
          ? { nextCursor: items.at(-1)!.event.id }
          : {}),
      };
    },

    async deleteAsset(input) {
      const sha256 = hex64.parse(input);
      const url = new URL(`/${sha256}`, base);
      await request(url, "Delete Lapis asset", { method: "DELETE" }, sha256);
    },
  };
}

function appendPage(
  url: URL,
  page: { limit?: number | undefined; cursor?: string | undefined },
): void {
  if (page.limit !== undefined)
    url.searchParams.set("limit", String(page.limit));
  if (page.cursor !== undefined) url.searchParams.set("cursor", page.cursor);
}

function parsePayload<T>(
  schema: z.ZodType<T>,
  value: unknown,
  label: string,
): T {
  const parsed = schema.safeParse(value);
  if (!parsed.success) throw new Error(`Relay returned invalid ${label}.`);
  return parsed.data;
}
