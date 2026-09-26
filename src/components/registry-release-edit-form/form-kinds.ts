import type { FormFieldKindDefinition } from "@lapismd/design-core/forms/core";

import type {
  RegistryReleaseEditDraft,
  RegistryReleaseGalleryItemDraft,
} from "./model.js";

declare module "@lapismd/design-core/forms/core" {
  interface FormFieldKindMap {
    "registry-description-composer": FormFieldKindDefinition<string>;
    "registry-highlight-list": FormFieldKindDefinition<
      string[],
      { addLabel?: string }
    >;
    "registry-copy-id": FormFieldKindDefinition<string, { copyLabel?: string }>;
    "registry-date-time": FormFieldKindDefinition<string>;
    "registry-publisher-identity": FormFieldKindDefinition<string>;
    "registry-media-sections": FormFieldKindDefinition<
      RegistryReleaseEditDraft["media"],
      { addLabel?: string }
    >;
    "registry-gallery": FormFieldKindDefinition<
      RegistryReleaseGalleryItemDraft[],
      { addLabel?: string }
    >;
  }
}

export type RegistryReleaseEditValues = RegistryReleaseEditDraft;
