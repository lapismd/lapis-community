import type { CommunityIdentity } from "../../community/index.js";
import type { CommunityLoginMethodModel } from "../community-login/model.js";

export interface CommunityApplicationLoginOptions {
  methods?: readonly CommunityLoginMethodModel[];
  allowLocalKeyMethods?: boolean;
  title?: string;
  description?: string;
  footnote?: string;
  connect?(methodId: string): Promise<CommunityIdentity>;
}
