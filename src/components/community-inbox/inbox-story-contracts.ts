import { expect, userEvent, within } from "storybook/test";

export function threadRegionHeightRules(element: Element): string[] {
  const hits: string[] = [];
  for (const sheet of element.ownerDocument.styleSheets) {
    let rules: CSSRuleList;
    try {
      rules = sheet.cssRules;
    } catch {
      continue;
    }
    for (const rule of rules) {
      if (
        !(rule instanceof CSSStyleRule) ||
        !rule.selectorText.includes("thread-region") ||
        rule.style.getPropertyValue("height") !== "100%"
      ) {
        continue;
      }
      try {
        if (element.matches(rule.selectorText)) hits.push(rule.selectorText);
      } catch {
        continue;
      }
    }
  }
  return hits;
}

export function expectMessageSkeletonInset(skeleton: HTMLElement) {
  const bounds = skeleton.getBoundingClientRect();
  const pane = skeleton.parentElement!.getBoundingClientRect();
  expect(bounds.left).toBeGreaterThan(pane.left);
  expect(bounds.top).toBeGreaterThan(pane.top);
  expect(bounds.right).toBeLessThan(pane.right);
}

export async function expectSelectedInboxConversationLoading(
  canvas: ReturnType<typeof within>,
): Promise<void> {
  await userEvent.click(
    canvas.getByRole("button", { name: /^Thread in #support:/u }),
  );
  await expect(
    canvas.queryByText(/What can we help you build/u),
  ).not.toBeInTheDocument();
  expectMessageSkeletonInset(
    canvas.getByRole("status", { name: "Loading Inbox messages" }),
  );
}
