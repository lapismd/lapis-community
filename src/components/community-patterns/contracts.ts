import { expect, userEvent, waitFor, within } from "storybook/test";
type Context = { canvasElement: HTMLElement };
const page = (c: Context) => within(c.canvasElement.ownerDocument.body);
async function fullEmoji(c: Context) {
  const emoji = await waitFor(() => {
    const button = c.canvasElement.ownerDocument
      .querySelector("em-emoji-picker")
      ?.shadowRoot?.querySelector<HTMLButtonElement>('button[aria-label="🤣"]');
    expect(button).toBeTruthy();
    return button!;
  });
  await userEvent.click(emoji);
}
export const contracts = {
  async dialog(c: Context) {
    const body = page(c),
      trigger = body.getByRole("button", { name: "Edit record" });
    await userEvent.click(trigger);
    const dialog = body.getByRole("dialog", { name: "Edit record" });
    const scroll = dialog.querySelector<HTMLElement>(
      '[data-ui-part="scroll-area-viewport"]',
    )!;
    const footer = dialog.querySelector<HTMLElement>(
      '[data-ui-part="dialog-frame-footer"]',
    )!;
    const y = footer.getBoundingClientRect().y;
    expect(scroll.scrollHeight).toBeGreaterThan(scroll.clientHeight);
    scroll.scrollTop = scroll.scrollHeight;
    await waitFor(() => expect(scroll.scrollTop).toBeGreaterThan(0));
    expect(footer.getBoundingClientRect().y).toBeCloseTo(y, 0);
    const close = within(dialog).getByRole("button", { name: "Close" });
    expect(close.getBoundingClientRect().width).toBe(32);
    expect(close.querySelector("svg")!.getBoundingClientRect().width).toBe(16);
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(trigger).toHaveFocus());
  },
  async confirmation(c: Context) {
    const body = page(c),
      trigger = body.getByRole("button", { name: "Remove record" });
    await userEvent.click(trigger);
    await userEvent.click(body.getByRole("button", { name: "Cancel" }));
    expect(body.getByRole("status")).toHaveTextContent("Record retained");
    await waitFor(() =>
      expect(body.queryByRole("alertdialog")).not.toBeInTheDocument(),
    );
    await waitFor(() =>
      expect(getComputedStyle(trigger).pointerEvents).not.toBe("none"),
    );
    await userEvent.click(trigger);
    await userEvent.click(body.getByRole("button", { name: "Remove" }));
    await waitFor(() =>
      expect(body.getByRole("alert")).toHaveTextContent("Please retry"),
    );
    await userEvent.click(body.getByRole("button", { name: "Remove" }));
    await waitFor(() =>
      expect(body.queryByRole("alertdialog")).not.toBeInTheDocument(),
    );
    expect(body.getByRole("status")).toHaveTextContent("Record removed");
  },
  async composer(c: Context) {
    const body = page(c),
      editor = c.canvasElement.querySelector<HTMLElement>(
        '.cm-content[contenteditable="true"]',
      )!;
    await userEvent.click(editor);
    await userEvent.keyboard("First{Enter}Second");
    expect(body.getByRole("status")).toHaveTextContent("");
    expect(editor.textContent).toContain("First");
    expect(editor.querySelectorAll(".cm-line").length).toBeGreaterThan(1);
    await userEvent.click(
      body.getByRole("button", { name: "Save description" }),
    );
    await waitFor(() =>
      expect(body.getByRole("status")).toHaveTextContent("First"),
    );
    expect(body.getByRole("status")).toHaveTextContent("Second");
  },
  async avatar(c: Context) {
    const body = page(c),
      trigger = body.getByRole("button", { name: "Choose avatar" });
    await userEvent.click(trigger);
    await userEvent.click(body.getByRole("tab", { name: "Emoji" }));
    await userEvent.click(
      body.getByRole("button", { name: "Browse all emoji" }),
    );
    await fullEmoji(c);
    await waitFor(() =>
      expect(
        body.getByRole("img", { name: "Selected avatar" }),
      ).toHaveAttribute("src", expect.stringContaining("data:image/svg+xml")),
    );
    expect(
      decodeURIComponent(
        body.getByRole("img", { name: "Selected avatar" }).getAttribute("src")!,
      ),
    ).toContain("🤣");
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(trigger).toHaveFocus());
  },
  async identity(c: Context) {
    const body = page(c);
    for (const [sectionName, triggerName, name] of [
      ["Avatar identity", "View Avery's profile", "Avery"],
      ["Avatar group identity", "View Avery's profile", "Avery"],
      ["Avatar group identity", "View Blake's profile", "Blake"],
      ["Avatar group identity", "View Casey's profile", "Casey"],
      ["Inline identity", "Avery", "Avery"],
      ["Markdown identity", "Avery", "Avery"],
      ["Composer identity", "Avery", "Avery"],
      ["Rounded agent identity", "View Nyra's profile", "Nyra"],
    ] as const) {
      const section = body.getByRole("region", { name: sectionName });
      const trigger = within(section).getByRole("button", {
        name: triggerName,
      });
      if (sectionName.startsWith("Rounded")) {
        expect(
          trigger.querySelector('[data-ui-component="community-member-avatar"]'),
        ).toHaveAttribute("data-shape", "rounded");
      }
      if (
        sectionName.includes("Inline") ||
        sectionName.includes("Markdown") ||
        sectionName.includes("Composer")
      ) {
        const avatar = trigger.querySelector<HTMLElement>(
          '[data-ui-component="community-member-avatar"]',
        )!;
        const initials = avatar.querySelector<HTMLElement>(
          '[data-ui-part="image"] > span',
        )!;
        const a = avatar.getBoundingClientRect(),
          i = initials.getBoundingClientRect();
        expect(i.width).toBeLessThan(a.width);
        expect(i.height).toBeLessThan(a.height);
        expect(Math.abs(i.x + i.width / 2 - a.x - a.width / 2)).toBeLessThan(1);
        expect(Math.abs(i.y + i.height / 2 - a.y - a.height / 2)).toBeLessThan(
          1,
        );
        expect(trigger.getBoundingClientRect().width).toBeLessThan(150);
        expect(trigger.getBoundingClientRect().height).toBeLessThanOrEqual(
          parseFloat(getComputedStyle(trigger).lineHeight) + 0.5,
        );
      }
      await userEvent.hover(trigger);
      const preview = await body.findByRole("group", {
        name: `${name} contact preview`,
      });
      const message = within(preview).getByRole("button", {
        name: `Message ${name}`,
      });
      const wave = within(preview).getByRole("button", {
        name: `Wave to ${name}`,
      });
      expect(message).toBeEnabled();
      expect(wave).toBeEnabled();
      await userEvent.click(message);
      expect(body.getByRole("status")).toHaveTextContent(`Message ${name}`);
      await userEvent.click(wave);
      expect(body.getByRole("status")).toHaveTextContent(`Waved to ${name}`);
      await userEvent.click(trigger);
      expect(body.getByRole("status")).toHaveTextContent(
        `${name} profile opened`,
      );
      await userEvent.unhover(trigger);
      trigger.blur();
      await userEvent.keyboard("{Escape}");
      await waitFor(() =>
        expect(
          body.queryByRole("group", { name: `${name} contact preview` }),
        ).not.toBeInTheDocument(),
      );
    }
  },
  async emoji(c: Context) {
    const body = page(c),
      trigger = body.getByRole("button", { name: "Choose emoji" });
    await userEvent.click(trigger);
    await fullEmoji(c);
    await waitFor(() =>
      expect(body.getByRole("status")).toHaveTextContent("🤣"),
    );
    await waitFor(() => expect(trigger).toHaveFocus());
  },
  async message(c: Context) {
    const body = page(c);
    expect(body.getByText("shared message").tagName).toBe("STRONG");
    expect(body.getByRole("link", { name: "Read the guide" })).toHaveAttribute(
      "href",
      "https://example.com/guide",
    );
    await userEvent.click(body.getByRole("button", { name: /👍/ }));
    expect(body.getByRole("status")).toHaveTextContent("👍");
    await userEvent.click(
      body.getByRole("button", { name: "View Avery's profile" }),
    );
    expect(body.getByRole("status")).toHaveTextContent("Avery profile opened");
  },
  async reactions(c: Context) {
    const body = page(c);
    await userEvent.click(body.getByRole("button", { name: /👍/ }));
    expect(body.getByRole("status")).toHaveTextContent("👍");
    await userEvent.click(body.getByRole("button", { name: "Add reaction" }));
    await fullEmoji(c);
    await waitFor(() =>
      expect(body.getByRole("status")).toHaveTextContent("🤣"),
    );
  },
  async markdown(c: Context) {
    const body = page(c);
    expect(body.getByText("Shared Markdown").tagName).toBe("STRONG");
    expect(body.getByRole("link", { name: "Read the guide" })).toHaveAttribute(
      "href",
      "https://example.com/guide",
    );
    expect(body.getAllByRole("listitem")).toHaveLength(2);
  },
  async loading(c: Context) {
    const body = page(c);
    expect(
      body.getByRole("status", { name: "Loading messages" }),
    ).toHaveAttribute("aria-busy", "true");
    expect(
      c.canvasElement.querySelectorAll('[data-slot="skeleton"]').length,
    ).toBeGreaterThan(4);
    await waitFor(
      () => expect(body.getByText("Research complete")).toBeVisible(),
      { timeout: 2500 },
    );
    expect(
      body.queryByRole("status", { name: "Loading messages" }),
    ).not.toBeInTheDocument();
    await userEvent.click(body.getByRole("button", { name: "Refresh" }));
    expect(body.getByText("Research complete")).toBeVisible();
    expect(
      body.queryByRole("status", { name: "Loading messages" }),
    ).not.toBeInTheDocument();
    await waitFor(() =>
      expect(body.getByRole("status")).toHaveTextContent("Up to date"),
    );
    await userEvent.click(body.getByRole("button", { name: "Load older" }));
    const edge = body.getByRole("status", { name: "Loading older messages" });
    expect(edge).toBeVisible();
    expect(edge.getBoundingClientRect().top).toBeGreaterThan(
      body.getByText("Research complete").getBoundingClientRect().bottom,
    );
    await waitFor(() => expect(body.getByText("Earlier update")).toBeVisible());
    expect(
      body.queryByRole("status", { name: "Loading older messages" }),
    ).not.toBeInTheDocument();
  },
  async loadingEmpty(c: Context) {
    const body = page(c);
    expect(
      body.getByRole("status", { name: "Loading messages" }),
    ).toBeVisible();
    await waitFor(
      () => expect(body.getByText("No messages yet.")).toBeVisible(),
      { timeout: 2500 },
    );
    expect(body.queryByRole("status")).not.toBeInTheDocument();
  },
  async loadingError(c: Context) {
    const body = page(c);
    await waitFor(
      () =>
        expect(body.getByRole("alert")).toHaveTextContent(
          "Messages could not be loaded",
        ),
      { timeout: 2500 },
    );
    expect(body.queryByRole("status")).not.toBeInTheDocument();
    await userEvent.click(body.getByRole("button", { name: "Retry" }));
    expect(body.getByText("Research complete")).toBeVisible();
  },
};
