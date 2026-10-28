import { describe, expect, it } from "vitest";
import { positionAt, positionBetween, STEP } from "../src/shared/position";

describe("posiciones fraccionales", () => {
  it("calcula extremos y punto medio", () => {
    expect(positionBetween(null, null)).toBe(STEP);
    expect(positionBetween(null, 100)).toBe(100 - STEP);
    expect(positionBetween(100, null)).toBe(100 + STEP);
    expect(positionBetween(100, 200)).toBe(150);
  });

  it("inserta al principio, en medio y al final de una lista", () => {
    const list = [{ position: 1024 }, { position: 2048 }];
    expect(positionAt(list, 0)).toBeLessThan(1024);
    expect(positionAt(list, 1)).toBe(1536);
    expect(positionAt(list, 2)).toBeGreaterThan(2048);
    expect(positionAt(list, 99)).toBeGreaterThan(2048);
  });

  it("aguanta muchas inserciones seguidas en el mismo hueco", () => {
    let lo = 1024;
    const hi = 2048;
    for (let i = 0; i < 40; i++) {
      const p = positionBetween(lo, hi);
      expect(p).toBeGreaterThan(lo);
      expect(p).toBeLessThan(hi);
      lo = p;
    }
  });
});
