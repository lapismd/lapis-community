import type {
  NostrEvent,
  NostrEventTemplate,
} from "@lapismd/registry-protocol";

export type { NostrEvent, NostrEventTemplate };

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
  backend: "nostr-buzz";
  root: string;
  acceptedEventIds: string[];
  sourceCounts: Record<string, number>;
  issues: RegistryIssue[];
}

export interface RegistryDashboard {
  index: RegistryIndex;
  provenance: RegistryProvenance;
  releaseEvents: number;
  decisionEvents: number;
}
