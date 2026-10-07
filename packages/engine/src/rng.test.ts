import { describe, it, expect } from "vitest";
import { nextFloat, nextInt, shuffle } from "./rng.js";

describe("rng", () => {
  it("produces the same sequence for the same seed", () => {
    const seqA: number[] = [];
    const seqB: number[] = [];
    let a = 123;
    let b = 123;
    for (let i = 0; i < 5; i++) {
      const ra = nextFloat(a);
      a = ra.state;
      seqA.push(ra.value);
      const rb = nextFloat(b);
      b = rb.state;
      seqB.push(rb.value);
    }
    expect(seqA).toEqual(seqB);
  });

  it("produces different sequences for different seeds", () => {
    const r1 = nextFloat(1).value;
    const r2 = nextFloat(2).value;
    expect(r1).not.toEqual(r2);
  });

  it("nextInt stays within range", () => {
    let s = 42;
    for (let i = 0; i < 50; i++) {
      const r = nextInt(s, 6);
      s = r.state;
      expect(r.value).toBeGreaterThanOrEqual(0);
      expect(r.value).toBeLessThan(6);
    }
  });

  it("shuffle is deterministic and a permutation", () => {
    const arr = [1, 2, 3, 4, 5, 6, 7, 8];
    const a = shuffle(999, arr);
    const b = shuffle(999, arr);
    expect(a.value).toEqual(b.value);
    expect([...a.value].sort((x, y) => x - y)).toEqual(arr);
  });
});
