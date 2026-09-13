import { getContext, setContext } from "svelte";
import type {
  CommunityAgentActivityContext,
  CommunityAgentsState,
} from "../../community/agent-contracts.js";
import type { CommunityRoomModel } from "../community-workspace/model.js";
const key = Symbol("community-agent-composer-activity");
interface ActivityOwner {
  model(): CommunityAgentsState | undefined;
  rooms(): readonly CommunityRoomModel[];
  open(agent: string, context: CommunityAgentActivityContext): void;
}
export const provideAgentComposerActivity = (owner: ActivityOwner): void => {
  setContext(key, owner);
};
export const useAgentComposerActivity = (): ActivityOwner | undefined =>
  getContext(key);
