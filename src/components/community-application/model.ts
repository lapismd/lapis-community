import type { CommunityIdentity } from "../../community/index.js";
import type {
  CommunityLoginCredentials,
  CommunityLoginMethodModel,
} from "../community-login/model.js";

export interface CommunityApplicationLoginOptions {
  methods?: readonly CommunityLoginMethodModel[];
  allowLocalKeyMethods?: boolean;
  title?: string;
  description?: string;
  footnote?: string;
  connect?(
    methodId: string,
    credentials?: CommunityLoginCredentials,
  ): Promise<CommunityIdentity>;
}
