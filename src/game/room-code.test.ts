import { describe, expect, it } from "vitest";
import { isRoomCode, makeRoomCode } from "./room-code";

describe("room codes", () => {
  it("generates six-character codes with exactly two digits", () => {
    for (let attempt = 0; attempt < 100; attempt++) {
      expect(isRoomCode(makeRoomCode())).toBe(true);
    }
  });

  it("accepts two digits in any positions", () => {
    expect(isRoomCode("A1B2CD")).toBe(true);
    expect(isRoomCode("12ABCD")).toBe(true);
    expect(isRoomCode("ABCD12")).toBe(true);
  });

  it("rejects codes with the wrong length or digit count", () => {
    expect(isRoomCode("ABCD")).toBe(false);
    expect(isRoomCode("ABCDEF")).toBe(false);
    expect(isRoomCode("A1BCDE")).toBe(false);
    expect(isRoomCode("A123BC")).toBe(false);
  });
});