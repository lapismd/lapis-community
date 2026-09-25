import { defineFormConfig } from "@lapismd/design-core/forms/core";

import "./form-kinds.js";
import type { RegistryReleaseEditDraft } from "./model.js";
import {
  registryReleaseCategorySuggestions,
  registryReleaseChannelOptions,
  registryReleasePlatformSuggestions,
  registryReleaseStatusOptions,
} from "./model.js";

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

export const registryReleaseEditConfig =
  defineFormConfig<RegistryReleaseEditDraft>()({
    id: "registry-release-edit",
    validationMode: "onTouched",
    groups: {
      identity: { title: "Listing", collapsible: true },
      release: { title: "Release", collapsible: true },
      content: { title: "Content references", collapsible: true },
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
        kind: "textarea",
        group: "identity",
        label: "Description",
        rows: 3,
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
        suggestions: registryReleaseCategorySuggestions,
      },
      "plugin.platforms": {
        kind: "tag-list",
        group: "identity",
        label: "Listing platforms",
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
        kind: "ordered-string-list",
        group: "identity",
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
        kind: "text",
        group: "release",
        label: "Released at",
      },
      "release.platforms": {
        kind: "tag-list",
        group: "release",
        label: "Release platforms",
        suggestions: registryReleasePlatformSuggestions,
      },
      "content.overview.url": {
        kind: "text",
        group: "content",
        label: "Overview markdown path",
      },
      "content.overview.sourceUrl": {
        kind: "text",
        group: "content",
        label: "Overview source URL",
        inputType: "url",
        validate: optionalUrl("Overview source URL"),
      },
      "content.overview.sha256": {
        kind: "text",
        group: "content",
        label: "Overview SHA-256",
      },
      "content.overview.size": {
        kind: "text",
        group: "content",
        label: "Overview size bytes",
      },
      "content.changelog.url": {
        kind: "text",
        group: "content",
        label: "Changelog markdown path",
      },
      "content.changelog.sourceUrl": {
        kind: "text",
        group: "content",
        label: "Changelog source URL",
        inputType: "url",
        validate: optionalUrl("Changelog source URL"),
      },
      "content.changelog.sha256": {
        kind: "text",
        group: "content",
        label: "Changelog SHA-256",
      },
      "content.changelog.size": {
        kind: "text",
        group: "content",
        label: "Changelog size bytes",
      },
      "media.logo": {
        kind: "registry-media-reference",
        group: "media",
        label: "Logo",
        addLabel: "Add logo reference",
      },
      "media.banner": {
        kind: "registry-media-reference",
        group: "media",
        label: "Banner",
        addLabel: "Add banner reference",
      },
      "media.overview": {
        kind: "registry-media-reference",
        group: "media",
        label: "Overview image",
        addLabel: "Add overview image",
      },
      "media.gallery": {
        kind: "registry-gallery",
        group: "media",
        label: "Screenshot carousel",
        addLabel: "Add screenshot",
      },
      "evidence.publisherIdentity": {
        kind: "readonly",
        group: "evidence",
        label: "Publisher identity",
        readonly: true,
      },
      "evidence.releaseEventId": {
        kind: "readonly",
        group: "evidence",
        label: "Release event ID",
        readonly: true,
      },
      "evidence.manifestSha256": {
        kind: "readonly",
        group: "evidence",
        label: "Manifest SHA-256",
        readonly: true,
      },
      "evidence.artifactUrl": {
        kind: "readonly",
        group: "evidence",
        label: "Artifact URL",
        readonly: true,
      },
      "evidence.artifactSha256": {
        kind: "readonly",
        group: "evidence",
        label: "Artifact SHA-256",
        readonly: true,
      },
      "evidence.bundleSize": {
        kind: "readonly",
        group: "evidence",
        label: "Bundle size",
        readonly: true,
      },
    },
  });
