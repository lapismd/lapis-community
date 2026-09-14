<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, userEvent, waitFor } from "storybook/test";
  import CommunityHistoryEdge from "./CommunityHistoryEdge.svelte";
  import Fixture from "../community-patterns/examples/HistoryExample.svelte";
  import source from "../community-patterns/examples/HistoryExample.svelte?raw";
  const { Story } = defineMeta({
    title: "Community/Patterns/History edge",
    component: CommunityHistoryEdge,
    tags: ["autodocs", "visual-pending"],
    parameters: {
      docs: {
        source: {
          language: "svelte",
          code: source,
        },
      },
    },
  });
</script>

<Story
  name="Guarded paging and retry"
  play={async ({ canvas, canvasElement }) => {
    const viewport = canvasElement.querySelector<HTMLElement>(
      '[data-ui-part="scroll-area-viewport"]',
    )!;
    await new Promise((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(resolve)),
    );
    expect(canvas.getByLabelText("Page requests")).toHaveTextContent("0");
    viewport.scrollTop = viewport.scrollHeight;
    viewport.dispatchEvent(new Event("scroll"));
    await waitFor(() =>
      expect(canvas.getByLabelText("Page requests")).toHaveTextContent("1"),
    );
    await waitFor(() =>
      expect(
        canvas.getByRole("button", { name: "Load earlier", exact: true }),
      ).toBeEnabled(),
    );
    viewport.dispatchEvent(new Event("scroll"));
    expect(canvas.getByLabelText("Page requests")).toHaveTextContent("1");
    await userEvent.click(
      canvas.getByRole("button", { name: "Load earlier", exact: true }),
    );
    await waitFor(() =>
      expect(canvas.getByRole("alert")).toHaveTextContent("Relay unavailable"),
    );
    await userEvent.click(
      canvas.getByRole("button", { name: "Retry earlier history" }),
    );
    await waitFor(() =>
      expect(canvas.getByLabelText("Page requests")).toHaveTextContent("3"),
    );
    await waitFor(() =>
      expect(canvas.queryByRole("alert")).not.toBeInTheDocument(),
    );
  }}>{#snippet template()}<Fixture />{/snippet}</Story
>
