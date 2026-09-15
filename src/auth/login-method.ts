export type CommunityLoginMethodKind =
  | "github"
  | "google"
  | "keytr"
  | "browser-extension"
  | "remote-signer"
  | "create-account"
  | "private-key"
  | "other";

export interface CommunityLoginMethodModel {
  id: string;
  kind: CommunityLoginMethodKind;
  label: string;
  description: string;
  disabled?: boolean;
  keytr?: {
    gateways: readonly {
      id: string;
      label: string;
      rpId: string;
    }[];
    allowSetup?: boolean;
    allowImport?: boolean;
    defaultPasskeyLabel?: string;
  };
}
