export type NostrTag = string[];

export interface NostrEvent {
  id: string;
  pubkey: string;
  created_at: number;
  kind: number;
  tags: NostrTag[];
  content: string;
  sig: string;
}

export interface NostrEventTemplate {
  kind: number;
  created_at: number;
  tags: NostrTag[];
  content: string;
}
