<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, fn, userEvent, waitFor } from "storybook/test";

  import RegistryVerifiedImage from "./RegistryVerifiedImage.svelte";
  import RegistryVerifiedImageStoryHarness from "./RegistryVerifiedImageStoryHarness.svelte";

  const reference = {
    url: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 240 160'%3E%3Crect width='240' height='160' fill='%2318171b'/%3E%3Ccircle cx='120' cy='80' r='44' fill='%23a855f7'/%3E%3C/svg%3E",
    sourceUrl: "https://assets.example/verified.svg",
    sha256: "a".repeat(64),
    size: 1,
    mediaType: "image/svg+xml" as const,
    width: 240,
    height: 160,
  };

  const { Story } = defineMeta({
    title: "Community/Registry/Verified Image",
    component: RegistryVerifiedImage,
    tags: ["visual-pending"],
    parameters: {
      docs: {
        source: {
          language: "svelte",
          code: `<script lang="ts">
  import { RegistryVerifiedImage } from "@lapismd/lapis-community/components";
<\/script>

<RegistryVerifiedImage {reference} alt="Verified plugin preview" />`,
        },
      },
    },
  });
</script>

<Story
  name="Projection URL"
  args={{ reference, alt: "Verified plugin preview" }}
/>

<Story
  name="Verified Blob lifecycle"
  play={async ({ canvas }) => {
    const originalCreate = URL.createObjectURL;
    const originalRevoke = URL.revokeObjectURL;
    const createObjectUrl = fn((blob: Blob) => originalCreate.call(URL, blob));
    const revokeObjectUrl = fn((url: string) => originalRevoke.call(URL, url));
    URL.createObjectURL = createObjectUrl;
    URL.revokeObjectURL = revokeObjectUrl;
    try {
      await userEvent.click(canvas.getByRole("button", { name: "Show image" }));
      await waitFor(() => expect(createObjectUrl).toHaveBeenCalledTimes(1));
      await waitFor(() =>
        expect(
          canvas.getByRole("img", { name: "Verified plugin preview" }),
        ).toHaveAttribute("src", expect.stringMatching(/^blob:/u)),
      );
      await userEvent.click(
        canvas.getByRole("button", { name: "Replace image" }),
      );
      await waitFor(() => expect(createObjectUrl).toHaveBeenCalledTimes(2));
      await expect(revokeObjectUrl).toHaveBeenCalledTimes(1);
      await userEvent.click(canvas.getByRole("button", { name: "Hide image" }));
      await waitFor(() => expect(revokeObjectUrl).toHaveBeenCalledTimes(2));
    } finally {
      URL.createObjectURL = originalCreate;
      URL.revokeObjectURL = originalRevoke;
    }
  }}
>
  {#snippet template()}
    <RegistryVerifiedImageStoryHarness />
  {/snippet}
</Story>
