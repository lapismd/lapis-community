import { expect, userEvent, within } from "storybook/test";

export function must<T>(value: T | null | undefined, message: string): T {
  if (value === null || value === undefined) throw new Error(message);
  return value;
}

export async function expectCopyIdButton(
  button: HTMLElement,
  shortValue: string,
): Promise<void> {
  await expect(button).toBeVisible();
  const icon = must(
    button.querySelector('[data-ui-part="copy-icon"]'),
    "Expected copy button icon",
  );
  await expect(icon.getBoundingClientRect().width).toBeGreaterThanOrEqual(9);
  await expect(icon.getBoundingClientRect().width).toBeLessThanOrEqual(11);
  await userEvent.hover(button);
  await expect(getComputedStyle(button).boxShadow).toBe("none");
  await userEvent.unhover(button);
  await expect(within(button).getByText(shortValue)).toBeVisible();
}

export async function expectCenteredFormFieldLabel(
  row: HTMLElement,
): Promise<void> {
  const label = must(
    row.querySelector<HTMLElement>(":scope > span"),
    "Expected form field label",
  );
  const control = must(
    row.querySelector<HTMLElement>(":scope > .cv-form-field-control"),
    "Expected form field control",
  );
  const labelBox = label.getBoundingClientRect();
  const controlBox = control.getBoundingClientRect();
  await expect(row.getAttribute("data-align")).toBe("center");
  await expect(
    Math.abs(
      labelBox.top +
        labelBox.height / 2 -
        (controlBox.top + controlBox.height / 2),
    ),
  ).toBeLessThanOrEqual(2);
}

export async function expectCenteredFieldLabelByPath(
  host: HTMLElement,
  path: string,
): Promise<void> {
  const row = must(
    host.querySelector<HTMLElement>(
      `[data-field-path="${path}"] [data-ui-part="form-field"]`,
    ),
    `Expected ${path} form row`,
  );
  await expectCenteredFormFieldLabel(row);
}

export async function expectReleaseDateTimeControls(
  host: HTMLElement,
): Promise<void> {
  const row = must(
    host.querySelector<HTMLElement>(
      '[data-field-path="release.releasedAt"] [data-ui-part="form-field"]',
    ),
    "Expected released at row",
  );
  await expect(row.querySelector("textarea")).toBeNull();
  await expect(
    within(row).getByRole("button", { name: "Released at date" }),
  ).toBeVisible();
  await expect(within(row).getByLabelText("Released at time")).toHaveAttribute(
    "type",
    "time",
  );
}

export async function expectEvidenceTab(
  canvas: ReturnType<typeof within>,
  releaseEventId: string,
  manifestSha256: string,
): Promise<void> {
  await expect(
    canvas.getByRole("img", { name: "npub1publisherexample avatar" }),
  ).toBeVisible();
  const releaseEventCopy = canvas.getByRole("button", {
    name: `Copy full Release event ID: ${releaseEventId}`,
  });
  const manifestHashCopy = canvas.getByRole("button", {
    name: `Copy full Manifest SHA-256: ${manifestSha256}`,
  });
  const artifactHashCopy = canvas.getByRole("button", {
    name: `Copy full Artifact SHA-256: ${"0".repeat(64)}`,
  });
  await expectCopyIdButton(releaseEventCopy, "1111111111…111111");
  await expectCopyIdButton(manifestHashCopy, "2222222222…222222");
  await expectCopyIdButton(artifactHashCopy, "0000000000…000000");
  await userEvent.hover(manifestHashCopy);
  await expect(
    await within(document.body).findByText(manifestSha256),
  ).toBeVisible();
  await userEvent.unhover(manifestHashCopy);
  const artifactHash = (
    canvas.getByText("Artifact SHA-256") as HTMLElement
  ).closest('[data-ui-part="form-field"]') as HTMLElement | null;
  if (artifactHash === null) {
    throw new Error("Expected artifact hash read-only row");
  }
  await expect(
    within(artifactHash).queryByRole("textbox"),
  ).not.toBeInTheDocument();
}

export function expectScrollFrame(element: HTMLElement): HTMLElement {
  const scrollArea = must(
    element.closest<HTMLElement>(
      '[data-ui-component="scroll-area"][data-ui-part="scroll-area"]',
    ),
    "Expected tab body scroll area",
  );
  const viewport = must(
    scrollArea.querySelector<HTMLElement>(
      '[data-ui-part="scroll-area-viewport"]',
    ),
    "Expected tab body scroll viewport",
  );
  const scrollbar = must(
    scrollArea.querySelector<HTMLElement>(
      '[data-ui-part="scroll-area-scrollbar"][data-orientation="vertical"]',
    ),
    "Expected tab body vertical scrollbar",
  );
  const scrollAreaBox = scrollArea.getBoundingClientRect();
  const scrollbarBox = scrollbar.getBoundingClientRect();
  expect(getComputedStyle(scrollArea).borderBlockStartStyle).toBe("solid");
  expect(getComputedStyle(scrollArea).overflowY).toBe("visible");
  expect(viewport.getBoundingClientRect().top).toBeGreaterThanOrEqual(
    scrollAreaBox.top,
  );
  expect(scrollbarBox.top).toBeGreaterThan(scrollAreaBox.top + 4);
  expect(scrollbarBox.bottom).toBeLessThan(scrollAreaBox.bottom - 4);
  return scrollArea;
}

export async function expectProseComposerLayout(
  host: HTMLElement,
): Promise<HTMLElement> {
  const editor = within(host).getByRole("textbox", {
    name: "Markdown editor",
  });
  const composer = must(
    host.querySelector<HTMLElement>(
      '[data-ui-component="community-chat-composer"]',
    ),
    "Expected prose composer",
  );
  const composerBody = must(
    composer.querySelector<HTMLElement>(
      '[data-ui-component="ai-chat-composer"] [data-ui-part="body"]',
    ),
    "Expected prose composer body",
  );
  const footer = must(
    composer.querySelector<HTMLElement>(
      '[data-ui-component="ai-chat-composer"] [data-ui-part="footer"]',
    ),
    "Expected prose composer footer",
  );
  const editorScrollArea = must(
    composer.querySelector<HTMLElement>(
      ".community-chat-composer__editor-scroll-area",
    ),
    "Expected prose composer editor scroll area",
  );
  const editorContent = must(
    composer.querySelector<HTMLElement>(".cm-content"),
    "Expected prose composer editor content",
  );
  const miraRoot = must(
    composer.querySelector<HTMLElement>(".community-chat-composer__mira"),
    "Expected prose composer Mira root",
  );
  const toolbar = must(
    composer.querySelector<HTMLElement>(
      ".community-chat-composer__toolbar-main",
    ),
    "Expected prose composer toolbar",
  );
  const toolbarIcon = must(
    composer.querySelector<SVGElement>(
      ".community-chat-composer__toolbar-main [data-ui-component='button'] svg",
    ),
    "Expected prose composer toolbar icon",
  );
  const label = host.matches('[data-ui-part="form-field"]')
    ? host.querySelector<HTMLElement>(":scope > span")
    : null;
  const lines = [...composer.querySelectorAll<HTMLElement>(".cm-line")];
  const firstLine = must(lines[0], "Expected prose composer text line");
  const lastLine = must(lines.at(-1), "Expected prose composer final line");

  await expect(editor).toBeVisible();
  await expect(
    within(host).queryByRole("button", { name: "Send message" }),
  ).not.toBeInTheDocument();
  const composerBodyStyle = getComputedStyle(composerBody);
  const editorScrollAreaStyle = getComputedStyle(editorScrollArea);
  const editorContentStyle = getComputedStyle(editorContent);
  const miraRootStyle = getComputedStyle(miraRoot);
  const firstLineStyle = getComputedStyle(firstLine);
  const firstLineHeight = firstLine.getBoundingClientRect().height;
  await expect(composerBodyStyle.boxShadow).toBe("none");
  await expect(composerBodyStyle.paddingBlockStart).toBe("0px");
  await expect(composerBodyStyle.paddingBlockEnd).toBe("0px");
  await expect(composerBodyStyle.paddingInlineStart).toBe("0px");
  await expect(composerBodyStyle.paddingInlineEnd).toBe("0px");
  await expect(editorContentStyle.paddingBlockStart).toBe("0px");
  await expect(editorContentStyle.paddingBlockEnd).toBe("0px");
  await expect(firstLineStyle.paddingInlineStart).toBe("0px");
  await expect(firstLineStyle.paddingInlineEnd).toBe("0px");
  await expect(parseFloat(editorScrollAreaStyle.minHeight)).toBeLessThanOrEqual(
    firstLineHeight + 1,
  );
  await expect(parseFloat(miraRootStyle.minHeight)).toBeLessThanOrEqual(
    firstLineHeight + 1,
  );
  await expect(getComputedStyle(footer).opacity).toBe("0");
  await userEvent.click(editor);
  await expect(getComputedStyle(footer).opacity).toBe("1");
  await expect(getComputedStyle(footer).marginBlockStart).toBe("0px");
  await expect(
    toolbar.getBoundingClientRect().top -
      lastLine.getBoundingClientRect().bottom,
  ).toBeLessThanOrEqual(4);
  if (label) {
    await expect(
      Math.abs(
        firstLine.getBoundingClientRect().top -
          label.getBoundingClientRect().top,
      ),
    ).toBeLessThanOrEqual(3);
  }
  await expect(
    Math.abs(
      toolbarIcon.getBoundingClientRect().left -
        editor.getBoundingClientRect().left,
    ),
  ).toBeLessThanOrEqual(2);
  const showFormatting = within(composer).getByRole("button", {
    name: "Show formatting",
  });
  await userEvent.click(showFormatting);
  await expect(getComputedStyle(footer).opacity).toBe("1");
  const hideFormatting = within(composer).getByRole("button", {
    name: "Hide formatting",
  });
  await expect(hideFormatting).toBeVisible();
  await userEvent.click(hideFormatting);
  await expect(getComputedStyle(footer).opacity).toBe("1");
  await userEvent.click(editor);
  return composer;
}

export async function expectHighlightsTabLayout(
  canvasElement: HTMLElement,
): Promise<void> {
  const highlightsField = must(
    canvasElement.querySelector<HTMLElement>(
      '[data-field-path="plugin.highlights"]',
    ),
    "Expected highlights form field",
  );
  const highlightsLabel = must(
    highlightsField.querySelector<HTMLElement>(
      '[data-ui-part="list-editor-label"]',
    ),
    "Expected highlights list label",
  );
  const highlightsHeader = must(
    highlightsField.querySelector<HTMLElement>(
      '[data-ui-part="list-editor-header"]',
    ),
    "Expected highlights list header",
  );
  const highlightsItems = must(
    highlightsField.querySelector<HTMLElement>(
      '[data-ui-part="list-editor-items"]',
    ),
    "Expected highlights list items",
  );
  const highlightsGroupBody = must(
    highlightsField.closest<HTMLElement>(".ui-configured-form-group__body"),
    "Expected highlights group body",
  );
  const tabScroll = must(
    highlightsField.closest<HTMLElement>(
      '[data-release-edit-tab="highlights"]',
    ),
    "Expected highlights tab scroll root",
  );
  const addHighlight = within(highlightsField).getByRole("button", {
    name: "Add highlight",
  });
  const addHighlightAction = must(
    addHighlight.closest<HTMLElement>(".cv-control-action-row"),
    "Expected add highlight action row",
  );
  const highlightsHeaderStyle = getComputedStyle(highlightsHeader);
  const highlightsItemsStyle = getComputedStyle(highlightsItems);
  const highlightsGroupBodyStyle = getComputedStyle(highlightsGroupBody);
  const addHighlightActionStyle = getComputedStyle(addHighlightAction);
  const highlightsItemsBox = highlightsItems.getBoundingClientRect();
  const highlightsHeaderBox = highlightsHeader.getBoundingClientRect();
  const addHighlightBox = addHighlight.getBoundingClientRect();
  const firstHighlight = must(
    highlightsItems.querySelector<HTMLElement>(
      '[data-ui-part="sortable-array-item"]',
    ),
    "Expected first highlight item",
  );
  const highlightRows = highlightsItems.querySelectorAll<HTMLElement>(
    '[data-ui-part="sortable-array-item"]',
  );
  const secondHighlight = must(
    highlightRows[1],
    "Expected second highlight item",
  );
  const firstHighlightRemove = within(firstHighlight).getByRole("button", {
    name: "Remove item",
  });
  const firstHighlightLine = must(
    firstHighlight.querySelector<HTMLElement>(".cm-line"),
    "Expected first highlight composer line",
  );

  await expect(getComputedStyle(tabScroll).borderBlockStartWidth).toBe("0px");
  await expect(getComputedStyle(highlightsLabel).display).toBe("none");
  await expect(highlightsGroupBodyStyle.borderBlockStartWidth).toBe("0px");
  await expect(highlightsItemsStyle.borderBlockStartStyle).toBe("solid");
  await expect(highlightsItemsStyle.gap).toBe("0px");
  await expect(highlightsHeaderStyle.display).toBe("flex");
  await expect(highlightsHeaderStyle.order).toBe("2");
  await expect(highlightsHeaderStyle.justifyContent).toBe("flex-end");
  await expect(highlightsHeaderStyle.borderBlockEndWidth).toBe("0px");
  await expect(addHighlightActionStyle.borderBottomWidth).toBe("0px");
  await expect(highlightsHeaderBox.top).toBeGreaterThanOrEqual(
    highlightsItemsBox.bottom,
  );
  await expect(
    Math.abs(addHighlightBox.right - highlightsItemsBox.right),
  ).toBeLessThanOrEqual(2);
  await expect(getComputedStyle(addHighlight).borderBlockStartStyle).toBe(
    "dashed",
  );
  await expect(
    within(highlightsItems).getAllByRole("textbox", {
      name: "Markdown editor",
    }).length,
  ).toBeGreaterThan(0);
  for (const [index, row] of Array.from(highlightRows).entries()) {
    const nextRow = highlightRows[index + 1];
    if (!nextRow) break;
    const rowStyle = getComputedStyle(row);
    const borderWidth = Number.parseFloat(rowStyle.borderBlockEndWidth);
    const lineAbove = must(
      row.querySelector<HTMLElement>(".cm-line"),
      "Expected highlight line above separator",
    );
    const lineBelow = must(
      nextRow.querySelector<HTMLElement>(".cm-line"),
      "Expected highlight line below separator",
    );
    const rowBox = row.getBoundingClientRect();
    const nextRowBox = nextRow.getBoundingClientRect();
    const separatorY = rowBox.bottom - borderWidth / 2;
    await expect(Math.abs(nextRowBox.top - rowBox.bottom)).toBeLessThanOrEqual(
      1,
    );
    await expect(
      Math.abs(
        separatorY -
          lineAbove.getBoundingClientRect().bottom -
          (lineBelow.getBoundingClientRect().top - separatorY),
      ),
    ).toBeLessThanOrEqual(1);
  }
  await expect(
    Math.abs(
      firstHighlightLine.getBoundingClientRect().top +
        firstHighlightLine.getBoundingClientRect().height / 2 -
        (firstHighlight.getBoundingClientRect().top +
          firstHighlight.getBoundingClientRect().height / 2),
    ),
  ).toBeLessThanOrEqual(2);
  await expectProseComposerLayout(firstHighlight);
  await expect(
    getComputedStyle(firstHighlight)
      .getPropertyValue("--ui-sortable-array-item-focus-background")
      .trim(),
  ).toBe("transparent");
  await expect(getComputedStyle(firstHighlight).backgroundColor).toBe(
    "rgba(0, 0, 0, 0)",
  );
  await expect(getComputedStyle(firstHighlight).paddingBlockStart).toBe("0px");
  await expect(getComputedStyle(firstHighlight).paddingBlockEnd).toBe("0px");
  await expect(
    Number.parseFloat(getComputedStyle(firstHighlight).minHeight),
  ).toBeGreaterThanOrEqual(26);
  await expect(getComputedStyle(secondHighlight).paddingBlockStart).toBe("0px");
  await expect(getComputedStyle(secondHighlight).paddingBlockEnd).toBe("0px");
  const firstHighlightRemoveStyle = getComputedStyle(firstHighlightRemove);
  await expect(firstHighlightRemoveStyle.borderRadius).toBe("999px");
  await expect(firstHighlightRemoveStyle.backgroundColor).not.toBe(
    "rgba(0, 0, 0, 0)",
  );
  await expect(
    highlightsItemsBox.right -
      firstHighlightRemove.getBoundingClientRect().right,
  ).toBeGreaterThanOrEqual(8);
  await expect(
    firstHighlightRemove.getBoundingClientRect().top -
      firstHighlight.getBoundingClientRect().top,
  ).toBeGreaterThanOrEqual(2);
  await expect(
    firstHighlight.getBoundingClientRect().bottom -
      firstHighlightRemove.getBoundingClientRect().bottom,
  ).toBeGreaterThanOrEqual(2);
}
