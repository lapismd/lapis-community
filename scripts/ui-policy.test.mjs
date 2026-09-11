import fs from "node:fs";
import { describe, it, expect } from "vitest";
import { inspectSource, validateCatalog } from "./ui-policy.mjs";
const file = "src/components/new-feature/NewFeature.svelte";
const rules = (source) => inspectSource(source, file).map((d) => d.rule);
describe("UI composition policy", () => {
  it("recognizes namespace, named, local aliases and dynamic components", () => {
    for (const source of [
      '<script>import * as D from "@lapismd/design-core/shadcn/dialog";</script><D.Content/>',
      '<script>import { Content as Body } from "@lapismd/design-core/shadcn/dialog";</script><Body/>',
      '<script>import * as D from "@lapismd/design-core/shadcn/dialog";const Body=D.Content;</script><Body/>',
      '<script>import * as D from "@lapismd/design-core/shadcn/dialog";</script><svelte:component this={D.Content}/>',
    ])
      expect(rules(source)).toContain("dialog");
  });
  it("rejects recreated prose, overlays, pickers, message bodies and styles", () => {
    for (const [source, rule] of [
      ["<textarea/>", "prose"],
      ['<div role="alertdialog"/>', "confirmation"],
      [
        '<script>import {Picker as Other} from "emoji-mart";new Other({});</script>',
        "emoji",
      ],
      [
        '<script>import { MessageBubble as Bubble } from "@lapismd/design-core/ai/chat";</script><Bubble/>',
        "message",
      ],
      ["<p>Loading agents…</p>", "loading"],
      ['<p style:font-size="12px">Hello</p>', "typography"],
      ["<p>Hello</p><style>p {font-size: 13px}</style>", "typography"],
      [
        '<p>Hello</p><style>:global([data-ui-part="dialog-content"]){width:100vw}</style>',
        "dialog",
      ],
    ])
      expect(rules(source)).toContain(rule);
  });
  it("allows canonical components, structured inputs and accessible loading announcements", () => {
    expect(
      rules(
        '<script>import DialogFrame from "@lapismd/design-core/forms/DialogFrame.svelte";</script><DialogFrame title="Edit"><input type="url"/></DialogFrame><span class="sr-only">Loading agents…</span><style>input{font-size:var(--community-text-body)}</style>',
      ),
    ).toEqual([]);
  });
  it("only allows an exact verified exception", () => {
    const source = "<textarea/>",
      exception = {
        file,
        rule: "prose",
        symbol: "textarea",
        reason: "Structured wire-format fixture",
        story: "community-patterns-composer--contract",
        requirement: "LC-UI-038",
      };
    expect(inspectSource(source, file, [exception])).toEqual([]);
    expect(
      inspectSource(source, file, [{ ...exception, file: "src/components/*" }]),
    ).not.toEqual([]);
    expect(
      inspectSource(source, file, [{ ...exception, reason: "" }]),
    ).not.toEqual([]);
  });
  it("identifies invalid catalog examples and omitted state coverage", () => {
    const diagnostics = validateCatalog(
      {
        patterns: [
          {
            id: "bad",
            component: "Missing",
            import: "@lapismd/lapis-community/components",
            example: "does-not-exist.svelte",
            storyFile: "does-not-exist.stories.svelte",
          },
        ],
      },
      process.cwd(),
    );
    expect(diagnostics.some((d) => d.detail.includes("loading coverage"))).toBe(
      true,
    );
    expect(diagnostics.some((d) => d.detail.includes("example:"))).toBe(true);
    expect(
      diagnostics.some((d) => d.detail.includes("missing public export")),
    ).toBe(true);
  });
  it("checks imperative editor widgets and lazy picker imports", () => {
    const filename = "src/components/new-feature/widget.ts";
    for (const [source, rule] of [
      ['const button=document.createElement("button");', "dom"],
      ['const textarea=document.createElement("textarea");', "prose"],
      ['const picker=await import("emoji-mart");', "emoji"],
      ['element.setAttribute("role", "dialog");', "dialog"],
    ])
      expect(inspectSource(source, filename).map((d) => d.rule)).toContain(
        rule,
      );
    expect(
      inspectSource(
        'import {mount} from "svelte";import Identity from "./Identity.svelte";const host=document.createElement("span");mount(Identity,{target:host});',
        filename,
      ),
    ).toEqual([]);
  });
  it("validates the real catalog and rejects broken story/state references", () => {
    const catalog = JSON.parse(
      fs.readFileSync("src/components/ui-catalog.json", "utf8"),
    );
    expect(validateCatalog(catalog, process.cwd())).toEqual([]);
    catalog.patterns[0].productionStories.push(
      "community-does-not-exist--missing",
    );
    catalog.patterns[0].verification.open = "community-does-not-exist--missing";
    const failures = validateCatalog(catalog, process.cwd());
    expect(
      failures.some((d) => d.detail.includes("missing production story")),
    ).toBe(true);
    expect(
      failures.some((d) => d.detail.includes("missing verification story")),
    ).toBe(true);
  });
});
