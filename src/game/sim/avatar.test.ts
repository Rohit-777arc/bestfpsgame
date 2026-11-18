import { describe, expect, it } from "vitest";
import {
  AVATAR_COLOR_OPTIONS,
  DEFAULT_AVATAR_COLORS,
  randomizeAvatarColors,
} from "./avatar";

describe("avatar colors", () => {
  it("randomizes each block-character color from the supported palette", () => {
    const colors = randomizeAvatarColors(() => 0.99);
    expect(Object.keys(colors)).toEqual(Object.keys(DEFAULT_AVATAR_COLORS));
    expect(Object.values(colors).every((color) => AVATAR_COLOR_OPTIONS.includes(color))).toBe(true);
  });
});
