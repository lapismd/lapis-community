import type { FormFieldKindDefinition } from "@lapismd/design-core/forms/core";

import type {
  RegistryReleaseEditDraft,
  RegistryReleaseGalleryItemDraft,
} from "./model.js";

declare module "@lapismd/design-core/forms/core" {
  interface FormFieldKindMap {
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
