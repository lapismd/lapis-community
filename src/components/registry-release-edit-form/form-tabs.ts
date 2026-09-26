import {
  getFormValueAtPath,
  type FormValidationIssue,
  type RuntimePathFormConfig,
} from "@lapismd/design-core/forms/core";

import { registryReleaseEditConfig } from "./form-config.js";
import type { RegistryReleaseEditDraft } from "./model.js";

export const registryReleaseEditTabs = [
  { value: "listing", label: "Listing", groupId: "identity" },
  { value: "release", label: "Release", groupId: "release" },
  { value: "content", label: "Content", groupId: "content" },
  { value: "media", label: "Media", groupId: "media" },
  { value: "evidence", label: "Evidence", groupId: "evidence" },
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
  const fields = Object.fromEntries(
    Object.entries(registryReleaseEditConfig.fields).filter(
      ([, field]) => field?.group === tab.groupId,
    ),
  );
  return {
    id: `registry-release-edit-${tab.value}`,
    validationMode: registryReleaseEditConfig.validationMode,
    groups: {
      [tab.groupId]: registryReleaseEditConfig.groups?.[tab.groupId]!,
    },
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
    registryReleaseEditTabs.find((tab) => tab.groupId === field?.group)
      ?.value ?? "listing"
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
