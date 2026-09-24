import { describe, expect, it } from "vitest";
import {
  editorRuntimePermissionSave,
  runtimePermissionOptions,
} from "./agent-runtime-permission.js";

const catalog = {
  configOptions: [
    {
      id: "mode",
      options: [
        { value: "default", name: "Ask" },
        { value: "bypassPermissions", name: "Bypass" },
      ],
    },
  ],
};

describe("runtime permission options", () => {
  it("keeps native catalog modes separate from the default approval policy", () => {
    expect(
      runtimePermissionOptions(catalog).map((option) => option.value),
    ).toEqual(["default", "bypassPermissions"]);
    expect(runtimePermissionOptions({ configOptions: [] })).toEqual([]);
    expect(
      editorRuntimePermissionSave(
        "claude",
        { model: "opus", permissionMode: "" },
        [],
        runtimePermissionOptions(catalog),
      ),
    ).toEqual({
      runtimeAgent: "claude",
      model: "opus",
      approvalPolicy: "allow-all",
    });
    expect(
      editorRuntimePermissionSave(
        "claude",
        { permissionMode: "bypassPermissions" },
        [],
        runtimePermissionOptions(catalog),
      ).permissionMode,
    ).toBe("bypassPermissions");
  });
});
