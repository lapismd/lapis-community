import { parse, compile } from "svelte/compiler";
import ts from "typescript";
import fs from "node:fs";
import path from "node:path";
export function walk(node, visit) {
  if (!node || typeof node !== "object") return;
  visit(node);
  for (const [key, value] of Object.entries(node)) {
    if (key === "parent") continue;
    if (Array.isArray(value)) value.forEach((child) => walk(child, visit));
    else if (value && typeof value === "object") walk(value, visit);
  }
}
const owners = {
  emoji: "src/components/community-emoji-picker/CommunityEmojiPicker.svelte",
  prose: "src/components/community-chat-composer/CommunityChatComposer.svelte",
  markdown:
    "src/components/community-markdown-content/CommunityMarkdownContent.svelte",
  avatar: "src/components/community-member-avatar/CommunityMemberAvatar.svelte",
  reactions: "src/components/community-reactions/CommunityReactions.svelte",
  message: "src/components/community-message/CommunityMessage.svelte",
  typography: "src/components/community-typography.css",
};
const replacements = {
  dom: "Mount the canonical Community component",
  dialog: "DialogFrame",
  confirmation: "ConfirmDialog / ConfirmButton",
  prose: "CommunityChatComposer mode=form",
  markdown: "CommunityMarkdownContent",
  avatar: "CommunityMemberHoverCard / CommunityMemberAvatar",
  emoji: "CommunityEmojiPicker",
  reactions: "CommunityReactions",
  message: "CommunityMessage / CommunityConversation",
  typography: "Community semantic type tokens",
  loading: "CommunitySkeleton with the destination layout",
};
const patternIds = {
  dom: "identity",
  dialog: "dialog",
  confirmation: "confirmation",
  prose: "composer",
  markdown: "markdown",
  avatar: "identity",
  emoji: "emoji",
  reactions: "reactions",
  message: "message",
  typography: "dialog",
  loading: "loading",
};
/** Parse imports, aliases, Svelte syntax and CSS. No source substring allowlist. */
export function inspectSource(source, filename, exceptions = []) {
  const diagnostics = [],
    isCss = filename.endsWith(".css"),
    isScript = /\.[cm]?[jt]s$/.test(filename);
  const report = (rule, node, detail) => {
    if (owners[rule] === filename) return;
    const line = source.slice(0, node?.start ?? 0).split("\n").length;
    if (
      exceptions.some(
        (e) =>
          e.file === filename &&
          e.rule === rule &&
          e.symbol === detail &&
          e.reason &&
          e.story &&
          e.requirement,
      )
    )
      return;
    diagnostics.push({
      file: filename,
      line,
      rule,
      detail,
      replacement: replacements[rule],
      example: `pnpm ui:catalog ${patternIds[rule]}`,
    });
  };
  let ast;
  try {
    ast = isScript
      ? {
          fragment: null,
          css: null,
          instance: { content: { start: 0, end: source.length } },
        }
      : parse(isCss ? `<style>${source}</style>` : source, { modern: true });
  } catch (cause) {
    return [
      {
        file: filename,
        line: 1,
        rule: "syntax",
        detail: cause.message,
        replacement: "Valid Svelte/CSS",
        example: "pnpm check:svelte",
      },
    ];
  }
  const bindings = new Map();
  for (const script of [ast.instance, ast.module].filter(Boolean)) {
    const tree = ts.createSourceFile(
      filename + ".ts",
      source.slice(script.content.start, script.content.end),
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TS,
    );
    for (const statement of tree.statements)
      if (ts.isImportDeclaration(statement)) {
        const module = statement.moduleSpecifier.text,
          clause = statement.importClause;
        if (clause?.name)
          bindings.set(clause.name.text, { module, symbol: "default" });
        const named = clause?.namedBindings;
        if (named && ts.isNamespaceImport(named))
          bindings.set(named.name.text, { module, symbol: "*" });
        else if (named)
          for (const e of named.elements)
            bindings.set(e.name.text, {
              module,
              symbol: e.propertyName?.text ?? e.name.text,
            });
        if (module === "emoji-mart" || module === "@emoji-mart/data")
          report("emoji", script, module);
      }
    function alias(n) {
      const location = { start: script.content.start + n.getStart(tree) };
      if (
        ts.isNewExpression(n) &&
        bindings.get(n.expression.getText(tree))?.module === "emoji-mart"
      )
        report("emoji", location, "Picker");
      if (ts.isCallExpression(n)) {
        const arg = n.arguments[0],
          value = arg && ts.isStringLiteralLike(arg) ? arg.text : undefined;
        if (
          n.expression.kind === ts.SyntaxKind.ImportKeyword &&
          ["emoji-mart", "@emoji-mart/data"].includes(value)
        )
          report("emoji", location, value);
        if (
          ts.isPropertyAccessExpression(n.expression) &&
          n.expression.name.text === "createElement" &&
          ["button", "textarea", "dialog"].includes(value)
        )
          report(
            value === "textarea"
              ? "prose"
              : value === "dialog"
                ? "dialog"
                : "dom",
            location,
            `createElement(${value})`,
          );
        if (
          ts.isPropertyAccessExpression(n.expression) &&
          n.expression.name.text === "setAttribute" &&
          value === "role"
        ) {
          const role = n.arguments[1];
          if (
            role &&
            ts.isStringLiteralLike(role) &&
            ["dialog", "alertdialog"].includes(role.text)
          )
            report(
              role.text === "dialog" ? "dialog" : "confirmation",
              location,
              `role=${role.text}`,
            );
        }
      }

      if (
        ts.isVariableDeclaration(n) &&
        ts.isIdentifier(n.name) &&
        n.initializer
      ) {
        let original = n.initializer.getText(tree);
        const parts = original.split(".");
        const imported = bindings.get(parts[0]);
        if (imported)
          bindings.set(n.name.text, {
            ...imported,
            symbol: parts[1] ?? imported.symbol,
          });
      }
      ts.forEachChild(n, alias);
    }
    alias(tree);
  }
  const governed = (name, node) => {
    const parts = name.split("."),
      binding = bindings.get(parts[0]);
    if (!binding) return;
    const { module } = binding,
      symbol = parts[1] ?? binding.symbol;
    if (
      module.includes("/shadcn/dialog") &&
      [
        "Content",
        "Overlay",
        "Portal",
        "Header",
        "Footer",
        "Title",
        "Description",
        "Close",
      ].includes(symbol)
    )
      report("dialog", node, `${module}:${symbol}`);
    if (module.includes("/shadcn/command") && symbol === "Dialog")
      report("dialog", node, `${module}:${symbol}`);
    if (module.includes("/shadcn/alert-dialog"))
      report("confirmation", node, `${module}:${symbol}`);
    if (
      module.includes("/shadcn/textarea") ||
      module.includes("@lapismd/mira/editor")
    )
      report("prose", node, `${module}:${symbol}`);
    if (module.includes("/shadcn/avatar"))
      report("avatar", node, `${module}:${symbol}`);
    if (
      module.includes("@lapismd/mira/preview") ||
      symbol === "MarkdownPreview"
    )
      report("markdown", node, `${module}:${symbol}`);
    if (symbol === "ReactionBar")
      report("reactions", node, `${module}:${symbol}`);
    if (
      ["Message", "MessageBubble"].includes(symbol) &&
      module.startsWith("@lapismd/design-core/ai/")
    )
      report("message", node, `${module}:${symbol}`);
  };
  walk(ast.fragment, (n) => {
    if (n.type === "Component") governed(n.name, n);
    if (n.type === "SvelteComponent" && n.expression) {
      const e = n.expression;
      governed(
        e.type === "MemberExpression"
          ? `${e.object.name}.${e.property.name}`
          : e.name,
        n,
      );
    }
    if (n.type === "RegularElement") {
      if (n.name === "textarea") report("prose", n, "textarea");
      for (const a of n.attributes ?? [])
        if (
          a.name === "role" &&
          a.value?.[0]?.type === "Text" &&
          ["dialog", "alertdialog"].includes(a.value[0].data)
        )
          report(
            a.value[0].data === "dialog" ? "dialog" : "confirmation",
            n,
            `role=${a.value[0].data}`,
          );
      if (["p", "div", "span"].includes(n.name)) {
        const text = n.fragment.nodes
          .map((x) => (x.type === "Text" ? x.data : ""))
          .join("")
          .trim();
        const hidden = n.attributes.some(
          (a) =>
            a.name === "class" &&
            Array.isArray(a.value) &&
            a.value.some((v) => v.data?.split(/\s+/).includes("sr-only")),
        );
        if (!hidden && /^Loading\b.*(?:…|\.\.\.)$/.test(text))
          report("loading", n, "visible loading banner");
      }
    }
    for (const a of n.attributes ?? []) {
      if (a.type === "StyleDirective" && ["font-size", "font"].includes(a.name))
        report("typography", a, `style:${a.name}`);
      if (a.name === "style")
        for (const v of Array.isArray(a.value) ? a.value : [])
          if (v.type === "Text" && /font(?:-size)?\s*:/.test(v.data))
            checkCss(
              parse(`<style>x{${v.data}}</style>`, { modern: true }).css,
            );
    }
  });
  function checkCss(css) {
    function visit(n, selector = "") {
      if (!n || typeof n !== "object") return;
      if (n.type === "Rule")
        selector = (isCss ? `<style>${source}</style>` : source).slice(
          n.prelude.start,
          n.prelude.end,
        );
      if (n.type === "Declaration") {
        const prop = n.property,
          value = n.value.trim();
        if (
          (prop === "font-size" || prop === "font") &&
          !/^(?:inherit|unset|var\(--community-text-(?:body|secondary|section|dialog|page|avatar-initials)\))$/.test(
            value,
          )
        )
          report("typography", n, prop);
        if (
          /(?:dialog-content|dialog-frame-|alert-dialog-content|dialog-close|\.community-chat-composer(?![\w-])|\.community-member-avatar(?![\w-])|data-ui-part=["']reaction)/.test(
            selector,
          ) &&
          [
            "width",
            "height",
            "font-size",
            "padding",
            "max-width",
            "position",
            "border-radius",
          ].includes(prop)
        ) {
          if (
            ![owners.prose, owners.avatar, owners.reactions].includes(filename)
          )
            report("dialog", n, `component internals: ${selector.trim()}`);
        }
      }
      for (const [k, v] of Object.entries(n))
        if (k !== "parent") {
          if (Array.isArray(v)) v.forEach((x) => visit(x, selector));
          else if (v && typeof v === "object") visit(v, selector);
        }
    }
    visit(css);
  }
  checkCss(ast.css);
  return diagnostics;
}
/** Read literal CSF metadata and Story nodes, including renamed exports. */
export function storyIndex(root) {
  const index = new Map();
  const dir = path.join(root, "src/components");
  if (!fs.existsSync(dir)) return index;
  const files = (directory) =>
    fs
      .readdirSync(directory, { withFileTypes: true })
      .flatMap((entry) =>
        entry.isDirectory()
          ? files(path.join(directory, entry.name))
          : [path.join(directory, entry.name)],
      );
  const slug = (text) =>
    text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
  for (const file of files(dir).filter((file) =>
    file.endsWith(".stories.svelte"),
  )) {
    const ast = parse(fs.readFileSync(file, "utf8"), { modern: true });
    let title, id;
    walk(ast.module, (node) => {
      if (node.type !== "CallExpression" || node.callee?.name !== "defineMeta")
        return;
      for (const prop of node.arguments[0]?.properties ?? []) {
        const key = prop.key?.name ?? prop.key?.value;
        if (key === "title") title = prop.value?.value;
        if (key === "id") id = prop.value?.value;
      }
    });
    if (!title && !id) continue;
    walk(ast.fragment, (node) => {
      if (node.type !== "Component" || node.name !== "Story") return;
      const attribute = (name) => {
        const value = node.attributes.find((a) => a.name === name)?.value?.[0];
        return value?.type === "Text" ? value.data : value?.expression?.value;
      };
      const name = attribute("name"),
        exportName = attribute("exportName");
      if (name || exportName)
        index.set(
          `${id ?? slug(title)}--${slug(exportName ?? name)}`,
          path.relative(root, file),
        );
    });
  }
  return index;
}
export function validateCatalog(catalog, root) {
  const failures = [];
  const seen = new Set();
  const stories = storyIndex(root);
  for (const p of catalog.patterns ?? []) {
    const fail = (detail) =>
      failures.push({
        file: "src/components/ui-catalog.json",
        line: 1,
        rule: "catalog",
        detail: `${p.id}: ${detail}`,
        replacement:
          "Valid compiled example, public export, story and state coverage",
        example: `pnpm ui:catalog ${p.id}`,
      });
    if (seen.has(p.id)) fail("duplicate id");
    seen.add(p.id);
    for (const key of [
      "component",
      "import",
      "when",
      "requirement",
      "example",
      "storyFile",
      "story",
    ])
      if (!p[key]) fail(`missing ${key}`);
    if (
      !p.requiredStates?.length ||
      !p.variants?.length ||
      !p.loading ||
      (!p.loading.applicable && !p.loading.reason)
    )
      fail("undeclared interaction or loading coverage");
    if (stories.get(p.story) !== p.storyFile)
      fail("missing catalog story ID or mismatched story file");
    for (const story of p.productionStories ?? [])
      if (!stories.has(story)) fail(`missing production story: ${story}`);
    for (const state of [
      ...(p.requiredStates ?? []),
      ...(p.loading?.states ?? []),
    ])
      if (!stories.has(p.verification?.[state]))
        fail(`missing verification story for state: ${state}`);
    try {
      const source = fs.readFileSync(path.join(root, p.example), "utf8");
      compile(source, { filename: p.example, generate: false });
      if (!source.includes(p.component) || !source.includes(p.import))
        fail("example does not consume the declared public component");
    } catch (e) {
      fail(`example: ${e.message}`);
    }
    try {
      const story = fs.readFileSync(path.join(root, p.storyFile), "utf8");
      if (
        !story.includes(path.basename(p.example)) ||
        !story.includes("?raw") ||
        !story.includes("play=")
      )
        fail(
          "story must compile and display the same example and run its contract",
        );
    } catch (e) {
      fail(`story: ${e.message}`);
    }
    if (p.import === "@lapismd/lapis-community/components") {
      const exports = fs.readFileSync(
        path.join(root, "src/components/index.ts"),
        "utf8",
      );
      for (const name of [p.component, ...(p.relatedComponents ?? [])])
        if (!new RegExp(`\\b${name}\\b`).test(exports))
          fail(`missing public export: ${name}`);
    } else {
      try {
        const pkg = JSON.parse(
          fs.readFileSync(
            path.join(root, "node_modules/@lapismd/design-core/package.json"),
            "utf8",
          ),
        );
        if (!pkg.exports[p.import.replace("@lapismd/design-core", ".")])
          fail("missing Design Core export");
      } catch (e) {
        fail(e.message);
      }
    }
  }
  for (const e of catalog.exceptions ?? [])
    if (
      !e.file ||
      e.file.includes("*") ||
      e.file.includes("..") ||
      !fs.existsSync(path.join(root, e.file ?? "")) ||
      !replacements[e.rule] ||
      !e.symbol ||
      !e.reason ||
      !stories.has(e.story) ||
      !e.requirement
    )
      failures.push({
        file: "src/components/ui-catalog.json",
        line: 1,
        rule: "exception",
        detail:
          "Exceptions must name one file and symbol, reason, specification and story",
        replacement: "Narrow verified exception",
        example: "pnpm ui:catalog",
      });
  return failures;
}
