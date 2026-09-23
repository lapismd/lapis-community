<script lang="ts">
  import { Button } from "@lapismd/design-core/shadcn/button";
  import * as Field from "@lapismd/design-core/shadcn/field";
  import { Input } from "@lapismd/design-core/shadcn/input";

  let {
    draft = $bindable({
      appId: "",
      installationId: "",
      credentialRef: "",
      webhookSecretRef: "",
      bridgeCredentialRef: "",
      bridgePubkey: "",
    }),
    replacing = false,
    onSubmit,
  }: {
    draft?:
      | {
          appId: string;
          installationId: string;
          credentialRef: string;
          webhookSecretRef: string;
          bridgeCredentialRef: string;
          bridgePubkey: string;
        }
      | undefined;
    replacing?: boolean | undefined;
    onSubmit: (event: SubmitEvent) => void;
  } = $props();
</script>

<form
  id="communityprojects-form-3"
  class="community-projects__project-form"
  onsubmit={onSubmit}
>
  <p class="community-projects__github-manager-note">
    {replacing
      ? "For security, the relay never returns App IDs or credential references. Enter the complete replacement configuration."
      : "Enter references to credentials already mounted on the relay. Secret values never pass through this form."}
  </p>
  <Field.Group class="community-projects__project-fields">
    <div class="community-projects__github-manager-field-grid">
      <Field.Field>
        <Field.Label for="github-app-id">GitHub App ID</Field.Label>
        <Input
          id="github-app-id"
          bind:value={draft.appId}
          autocomplete="off"
          placeholder="12345"
          required
        />
      </Field.Field>
      <Field.Field>
        <Field.Label for="github-installation-id">Installation ID</Field.Label>
        <Input
          id="github-installation-id"
          type="number"
          min="1"
          step="1"
          bind:value={draft.installationId}
          placeholder="67890"
          required
        />
      </Field.Field>
    </div>
    <Field.Field>
      <Field.Label for="github-app-credential"
        >App private-key reference</Field.Label
      >
      <Input
        id="github-app-credential"
        type="password"
        bind:value={draft.credentialRef}
        autocomplete="new-password"
        placeholder="file:github-app.pem"
        required
      />
    </Field.Field>
    <Field.Field>
      <Field.Label for="github-webhook-credential"
        >Webhook-secret reference</Field.Label
      >
      <Input
        id="github-webhook-credential"
        type="password"
        bind:value={draft.webhookSecretRef}
        autocomplete="new-password"
        placeholder="file:github-webhook"
        required
      />
    </Field.Field>
    <Field.Field>
      <Field.Label for="github-bridge-credential"
        >Bridge-key reference</Field.Label
      >
      <Input
        id="github-bridge-credential"
        type="password"
        bind:value={draft.bridgeCredentialRef}
        autocomplete="new-password"
        placeholder="file:github-bridge-secret"
        required
      />
    </Field.Field>
    <Field.Field>
      <Field.Label for="github-bridge-pubkey">Bridge public key</Field.Label>
      <Input
        id="github-bridge-pubkey"
        bind:value={draft.bridgePubkey}
        autocomplete="off"
        minlength={64}
        maxlength={64}
        placeholder="64-character hexadecimal public key"
        required
      />
    </Field.Field>
  </Field.Group>
</form>
