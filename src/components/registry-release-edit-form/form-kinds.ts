import type { FormFieldKindDefinition } from "@lapismd/design-core/forms/core";

import type {
  RegistryReleaseEditDraft,
  RegistryReleaseGalleryItemDraft,
  RegistryReleaseMediaReferenceDraft,
} from "./model.js";

declare module "@lapismd/design-core/forms/core" {
  interface FormFieldKindMap {
    "registry-media-reference": FormFieldKindDefinition<
      RegistryReleaseMediaReferenceDraft | null,
      { addLabel?: string }
    >;
    "registry-gallery": FormFieldKindDefinition<
      RegistryReleaseGalleryItemDraft[],
      { addLabel?: string }
    >;
  }
}

export type RegistryReleaseEditValues = RegistryReleaseEditDraft;
