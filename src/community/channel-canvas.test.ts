import { finalizeEvent, getPublicKey } from "nostr-tools/pure";
import { describe, expect, it } from "vitest";
import {
  canvasEditingAllowed,
  latestChannelCanvas,
  validateCanvasContent,
} from "./channel-canvas.js";

const key = new Uint8Array(32).fill(32);
const author = getPublicKey(key);
const sign = (
  kind: number,
  content: string,
  tags: string[][],
  created_at = 100,
) => finalizeEvent({ kind, content, tags, created_at }, key);

describe("channel canvas snapshots", () => {
  it("selects deterministic signed snapshots and retains an explicit empty head", () => {
    const first = sign(40_100, "# Buzz canvas", [["h", "room"]]);
    const other = sign(40_100, "Other snapshot", [["h", "room"]]);
    const expected = [first, other].sort((a, b) => a.id.localeCompare(b.id))[0];
    expect(latestChannelCanvas([first, other, first], "room")).toEqual(
      expected,
    );
    expect(latestChannelCanvas([other, first], "room")).toEqual(expected);
    const clear = sign(40_100, "", [["h", "room"]], 101);
    expect(latestChannelCanvas([first, clear], "room")?.content).toBe("");
    expect(latestChannelCanvas([first, clear], "different-room")).toBeNull();
  });
  it("rejects unsigned, ambiguous, and oversized documents", () => {
    const event = sign(40_100, "# Canvas", [["h", "room"]]);
    const invalid = {
      ...event,
      content: "Changed after signing",
      sig: "0".repeat(128),
    };
    expect(
      latestChannelCanvas(
        [
          invalid,
          sign(40_100, "ambiguous", [
            ["h", "room"],
            ["h", "room"],
          ]),
          sign(40_100, "é".repeat(32_769), [["h", "room"]]),
        ],
        "room",
      ),
    ).toBeNull();
    expect(() => validateCanvasContent("é".repeat(32_768))).not.toThrow();
    expect(() => validateCanvasContent("é".repeat(32_769))).toThrow("64 KiB");
  });
  it("requires complete matching relay membership and management state and denies archives", () => {
    const metadata = sign(39_000, "", [["d", "room"]]);
    const admins = sign(39_001, "", [
      ["d", "room"],
      ["p", author],
    ]);
    const members = sign(39_002, "", [
      ["d", "room"],
      ["p", author],
    ]);
    expect(
      canvasEditingAllowed([metadata, admins, members], "room", author),
    ).toBe(true);
    expect(canvasEditingAllowed([metadata, members], "room", author)).toBe(
      false,
    );
    expect(canvasEditingAllowed([metadata, admins], "room", author)).toBe(
      false,
    );
    expect(
      canvasEditingAllowed(
        [
          metadata,
          admins,
          members,
          sign(39_000, '{"archived":true}', [["d", "room"]], 101),
        ],
        "room",
        author,
      ),
    ).toBe(false);
    expect(
      canvasEditingAllowed([metadata, admins, members], "room", "0".repeat(64)),
    ).toBe(false);
  });
});
