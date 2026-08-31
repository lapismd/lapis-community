export type NostrTag = [string, ...string[]];

export interface NostrEventTemplate {
  kind: number;
  created_at: number;
  tags: NostrTag[];
  content: string;
}

export interface NostrEvent extends NostrEventTemplate {
  id: string;
  pubkey: string;
  sig: string;
}

export interface Nip07Provider {
  getPublicKey(): Promise<string>;
  signEvent(event: NostrEventTemplate): Promise<NostrEvent>;
}

declare global {
  interface Window {
    nostr?: Nip07Provider;
  }
}

export interface RegistryIndexPlugin {
  id: string;
  name: string;
  description: string;
  latestVersion: string;
  status: string;
  channel: string;
}

export interface RegistryIndex {
  schemaVersion: number;
  generatedAt: string;
  plugins: RegistryIndexPlugin[];
}

export interface RegistryIssue {
  code: string;
  eventId: string;
  message: string;
}

export interface RegistryProvenance {
  backend: string;
  root: string;
  acceptedEventIds: string[];
  exclusionCounts: Record<string, number>;
  sourceCounts: Record<string, number>;
  issues: RegistryIssue[];
}

export interface CommunityProjection {
  root: string;
  ratingAggregates: Array<{
    pluginId: string;
    count: number;
    average: number | null;
  }>;
  reviews: Array<{
    pluginId: string;
    content: string;
    event: { id: string };
  }>;
  reports: Array<{
    reportTypes: string[];
    event: { id: string };
  }>;
  collections: Array<{
    identifier: string;
    title?: string;
    pluginIds: string[];
    event: { id: string };
  }>;
  followLists: Array<{ pubkeys: string[]; event: { id: string } }>;
  exclusionCounts: { hiddenEvent: number; mutedPubkey: number };
  issues: RegistryIssue[];
}

export interface SecurityProjection {
  root: string;
  statuses: Array<{
    advisory: {
      advisoryId: string;
      pluginId: string;
      severity: string;
      summary: string;
    };
    enforcement: "block" | "none" | "warn";
    advisoryEvent: { id: string };
    dispositionEvent?: { id: string };
  }>;
  issues: RegistryIssue[];
}

export interface RegistryDashboard {
  index: RegistryIndex;
  provenance: RegistryProvenance;
  community: CommunityProjection;
  security: SecurityProjection;
  unsigned: boolean;
  responseRoot: string;
  communityRoot: string;
  securityRoot: string;
}
