import {
  getFormValueAtPath,
  type FormValidationIssue,
  type RuntimePathFormConfig,
} from "@lapismd/design-core/forms/core";

import { registryReleaseEditConfig } from "./form-config.js";
import type { RegistryReleaseEditDraft } from "./model.js";

export const registryReleaseEditTabs = [
  {
    value: "details",
    label: "Details",
    groupIds: ["identity"],
    collapsibleGroupIds: [],
  },
  {
    value: "highlights",
    label: "Highlights",
    groupIds: ["highlights"],
    collapsibleGroupIds: [],
  },
  {
    value: "release",
    label: "Release",
    groupIds: ["release"],
    collapsibleGroupIds: [],
  },
  {
    value: "media",
    label: "Media",
    groupIds: ["media"],
    collapsibleGroupIds: [],
  },
  {
    value: "evidence",
    label: "Evidence",
    groupIds: ["evidence"],
    collapsibleGroupIds: [],
  },
] as const;

export type RegistryReleaseEditTab =
  (typeof registryReleaseEditTabs)[number]["value"];

type RegistryReleaseEditConfig = RuntimePathFormConfig<
  RegistryReleaseEditDraft,
  undefined
>;

function configForGroup(
  tab: (typeof registryReleaseEditTabs)[number],
): RegistryReleaseEditConfig {
  const groupIds = new Set<string>(tab.groupIds);
  const hideSingleGroupHeader = tab.groupIds.length === 1;
  const fields = Object.fromEntries(
    Object.entries(registryReleaseEditConfig.fields).filter(
      ([, field]) =>
        typeof field?.group === "string" && groupIds.has(field.group),
    ),
  );
  const groups = Object.fromEntries(
    tab.groupIds.map((groupId) => {
      const group = registryReleaseEditConfig.groups?.[groupId]!;
      return [
        groupId,
        hideSingleGroupHeader
          ? { ...group, hiddenHeader: true, collapsible: false }
          : group,
      ];
    }),
  );
  return {
    id: `registry-release-edit-${tab.value}`,
    validationMode: registryReleaseEditConfig.validationMode,
    groups,
    fields,
  } as RegistryReleaseEditConfig;
}

export const registryReleaseEditTabConfigs = Object.fromEntries(
  registryReleaseEditTabs.map((tab) => [tab.value, configForGroup(tab)]),
) as Record<RegistryReleaseEditTab, RegistryReleaseEditConfig>;

export function registryReleaseTabForPath(
  path: string | undefined,
): RegistryReleaseEditTab {
  const field =
    path === undefined
      ? undefined
      : registryReleaseEditConfig.fields[
          path as keyof typeof registryReleaseEditConfig.fields
        ];
  return (
    registryReleaseEditTabs.find(
      (tab) =>
        typeof field?.group === "string" &&
        (tab.groupIds as readonly string[]).includes(field.group),
    )?.value ?? "details"
  );
}

export async function validateRegistryReleaseEditDraft(
  draft: RegistryReleaseEditDraft,
): Promise<FormValidationIssue[]> {
  const issues: FormValidationIssue[] = [];
  for (const [path, field] of Object.entries(
    registryReleaseEditConfig.fields,
  )) {
    if (typeof field?.validate !== "function") continue;
    const validate = field.validate as (
      value: unknown,
      args: { root: RegistryReleaseEditDraft; context: undefined; path: never },
    ) =>
      | Promise<string | FormValidationIssue | null | undefined>
      | string
      | FormValidationIssue
      | null
      | undefined;
    const issue = await validate(getFormValueAtPath(draft, path), {
      root: draft,
      context: undefined,
      path: path as never,
    });
    if (!issue) continue;
    issues.push(
      typeof issue === "string"
        ? { path: path as never, message: issue }
        : { ...issue, path: (issue.path ?? path) as never },
    );
  }
  return issues;
}
