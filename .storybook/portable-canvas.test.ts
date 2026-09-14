import { expect, it, vi } from "vitest";
import { preparePortableApplicationCanvas } from "./portable-canvas.js";

it("sizes an unnamed portable application canvas without replacing the regular Storybook root", () => {
  const toggle = vi.fn();
  const body = { classList: { toggle } };
  const document = {
    body,
    getElementById: vi.fn(() => null),
  } as unknown as Document;
  const canvas = { parentElement: body, id: "" } as unknown as HTMLElement;
  preparePortableApplicationCanvas(document, canvas, true);
  expect(canvas.id).toBe("storybook-root");
  expect(toggle).toHaveBeenLastCalledWith("sb-main-fullscreen", true);
  const regular = {
    parentElement: body,
    id: "storybook-root",
  } as unknown as HTMLElement;
  preparePortableApplicationCanvas(document, regular, false);
  expect(toggle).toHaveBeenCalledTimes(1);
  const next = { parentElement: body, id: "" } as unknown as HTMLElement;
  preparePortableApplicationCanvas(document, next, false);
  expect(next.id).toBe("");
  expect(toggle).toHaveBeenLastCalledWith("sb-main-fullscreen", false);
});
