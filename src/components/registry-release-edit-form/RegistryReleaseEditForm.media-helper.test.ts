import { userEvent, within } from "storybook/test";

import { expectShaSplitButton } from "./RegistryReleaseEditForm.sha-helper.test.js";

export async function editBannerMediaSha(
  canvas: ReturnType<typeof within>,
  nextValue: string,
): Promise<void> {
  const preview = await expectShaSplitButton(
    document.body,
    "Banner Light SHA-256",
    "0".repeat(64),
  );
  await userEvent.click(preview);
  const input = canvas.getByRole("textbox", {
    name: "Banner Light SHA-256",
  });
  await userEvent.clear(input);
  await userEvent.type(input, nextValue);
  await userEvent.tab();
}
