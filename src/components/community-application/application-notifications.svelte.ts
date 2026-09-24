import { untrack } from "svelte";
import { toast } from "svelte-sonner";
import { permissionNoticeKey } from "../../community/agent-permission-notices.js";
import { permissionHasExpired } from "../../community/permission-expiry.js";
import type { AgentPermissionNotice } from "../../community/agent-permission-notices.js";
import type {
  CommunityAgentsState,
  CommunityAgentActivityContext,
} from "../../community/agent-contracts.js";

/** The application owns toast lifetime; the controller owns notification deduplication. */
export function provideApplicationNotifications(owner: {
  scope: string;
  reconnectAccountId(): string | undefined;
  reconnect(): void;
  agents(): CommunityAgentsState | undefined;
  take(): readonly AgentPermissionNotice[];
  open(agent: string, context: CommunityAgentActivityContext): void;
}) {
  const shown = new Map<string, string>();
  $effect(() => {
    const accountId = owner.reconnectAccountId();
    if (accountId === undefined) return;
    const id = `${owner.scope}-reconnect-${accountId}`;
    untrack(() =>
      toast.info("Reconnect your Nostr signer", {
        id,
        description:
          "Your account is remembered. Reconnect its signing key to send messages and perform actions.",
        duration: Infinity,
        dismissible: true,
        closeButton: true,
        action: { label: "Reconnect signer", onClick: owner.reconnect },
      }),
    );
    return () => {
      toast.dismiss(id);
    };
  });
  $effect(() => {
    const model = owner.agents();
    const pending = Object.values(model?.pendingPermissions ?? {}).flat();
    const agents = model?.agents ?? [];
    untrack(() => {
      const active = new Set(
        pending
          .filter((request) => !permissionHasExpired(request, Date.now()))
          .map(permissionNoticeKey),
      );
      for (const [key, id] of shown)
        if (!active.has(key)) {
          toast.dismiss(id);
          shown.delete(key);
        }
      if (!model) return;
      for (const notice of owner.take()) {
        if (!active.has(notice.key) || shown.has(notice.key)) continue;
        const id = `${owner.scope}-permission-${notice.key}`;
        shown.set(notice.key, id);
        const name =
          agents.find((agent) => agent.pubkey === notice.agentPubkey)?.name ??
          "Agent";
        toast.message(`${name} is waiting for your permission`, {
          id,
          description: notice.tool,
          closeButton: true,
          dismissible: true,
          duration:
            notice.expiresAt === undefined
              ? Infinity
              : Math.max(0, notice.expiresAt - Date.now()),
          action: {
            label: "Review request",
            onClick: () => owner.open(notice.agentPubkey, notice.context),
          },
        });
      }
    });
  });
  $effect(() => () => {
    for (const id of shown.values()) toast.dismiss(id);
    shown.clear();
  });
}
