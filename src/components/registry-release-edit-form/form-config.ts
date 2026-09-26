import { defineFormConfig } from "@lapismd/design-core/forms/core";
import type { RuntimePathFormConfig } from "@lapismd/design-core/forms/core";

import "./form-kinds.js";
import type { RegistryReleaseEditDraft } from "./model.js";
import {
  registryReleaseCategorySuggestions,
  registryReleaseChannelOptions,
  registryReleasePlatformSuggestions,
} from "./model.js";
import { registryReleaseStatusOptions } from "./status-options.js";

const required = (label: string) => (value: string) =>
  value.trim() ? undefined : `${label} is required`;

const optionalUrl = (label: string) => (value: string) => {
  if (!value.trim()) return undefined;
  try {
    new URL(value);
    return undefined;
  } catch {
    return `${label} must be a valid URL`;
  }
};

export const registryReleaseEditConfig: RuntimePathFormConfig<RegistryReleaseEditDraft> =
  defineFormConfig<RegistryReleaseEditDraft>()({
    id: "registry-release-edit",
    validationMode: "onTouched",
    groups: {
      identity: { title: "Details", collapsible: true },
      highlights: { title: "Highlights", collapsible: false },
      release: { title: "Release", collapsible: true },
      media: { title: "Media references", collapsible: true },
      evidence: { title: "Signed evidence", collapsible: true },
    },
    fields: {
      "plugin.name": {
        kind: "text",
        group: "identity",
        label: "Plugin name",
        validate: required("Plugin name"),
      },
      "plugin.description": {
        kind: "registry-description-composer",
        group: "identity",
        label: "Description",
        placeholder: "Describe what the plugin does.",
        validate: required("Description"),
      },
      "plugin.author": {
        kind: "text",
        group: "identity",
        label: "Author",
        validate: required("Author"),
      },
      "plugin.authorUrl": {
        kind: "text",
        group: "identity",
        label: "Author URL",
        inputType: "url",
        validate: optionalUrl("Author URL"),
      },
      "plugin.authorAvatarUrl": {
        kind: "text",
        group: "identity",
        label: "Author avatar URL",
        inputType: "url",
        validate: optionalUrl("Author avatar URL"),
      },
      "plugin.channel": {
        kind: "segmented",
        group: "identity",
        label: "Channel",
        options: registryReleaseChannelOptions,
      },
      "plugin.status": {
        kind: "choice",
        group: "identity",
        label: "Status",
        options: registryReleaseStatusOptions,
      },
      "plugin.categories": {
        kind: "tag-list",
        group: "identity",
        label: "Categories",
        align: "center",
        suggestions: registryReleaseCategorySuggestions,
      },
      "plugin.platforms": {
        kind: "tag-list",
        group: "identity",
        label: "Listing platforms",
        align: "center",
        suggestions: registryReleasePlatformSuggestions,
      },
      "plugin.license": {
        kind: "text",
        group: "identity",
        label: "License",
      },
      "plugin.links.homepage": {
        kind: "text",
        group: "identity",
        label: "Homepage",
        inputType: "url",
        validate: optionalUrl("Homepage"),
      },
      "plugin.links.repository": {
        kind: "text",
        group: "identity",
        label: "Repository",
        inputType: "url",
        validate: optionalUrl("Repository"),
      },
      "plugin.links.documentation": {
        kind: "text",
        group: "identity",
        label: "Documentation",
        inputType: "url",
        validate: optionalUrl("Documentation"),
      },
      "plugin.links.issues": {
        kind: "text",
        group: "identity",
        label: "Issues",
        inputType: "url",
        validate: optionalUrl("Issues"),
      },
      "plugin.highlights": {
        kind: "registry-highlight-list",
        group: "highlights",
        label: "Highlights",
        addLabel: "Add highlight",
      },
      "release.version": {
        kind: "text",
        group: "release",
        label: "Version",
        validate: required("Version"),
      },
      "release.minAppVersion": {
        kind: "text",
        group: "release",
        label: "Minimum app version",
        validate: required("Minimum app version"),
      },
      "release.releasedAt": {
        kind: "registry-date-time",
        group: "release",
        label: "Released at",
      },
      "release.platforms": {
        kind: "tag-list",
        group: "release",
        label: "Release platforms",
        align: "center",
        suggestions: registryReleasePlatformSuggestions,
      },
      media: {
        kind: "registry-media-sections",
        group: "media",
        label: "Media references",
        addLabel: "Add media reference",
      },
      "evidence.publisherIdentity": {
        kind: "registry-publisher-identity",
        group: "evidence",
        label: "Publisher identity",
      },
      "evidence.releaseEventId": {
        kind: "registry-copy-id",
        group: "evidence",
        label: "Release event ID",
        copyLabel: "Release event ID",
      },
      "evidence.manifestSha256": {
        kind: "registry-copy-id",
        group: "evidence",
        label: "Manifest SHA-256",
        copyLabel: "Manifest SHA-256",
      },
      "evidence.artifactUrl": {
        kind: "readonly",
        group: "evidence",
        label: "Artifact URL",
        readonly: true,
      },
      "evidence.artifactSha256": {
        kind: "registry-copy-id",
        group: "evidence",
        label: "Artifact SHA-256",
        copyLabel: "Artifact SHA-256",
      },
      "evidence.bundleSize": {
        kind: "readonly",
        group: "evidence",
        label: "Bundle size",
        readonly: true,
      },
    },
  });
