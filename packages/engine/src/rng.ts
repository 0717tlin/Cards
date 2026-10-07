// Deterministic seeded RNG (mulberry32). The engine threads a numeric state
// through BattleState so that randomness is fully reproducible. Never use
// Math.random in engine code (see .kiro/steering/tech-stack.md).

/** Advance the RNG state and return a float in [0, 1) plus the next state. */
export function nextFloat(state: number): { value: number; state: number } {
  let t = (state + 0x6d2b79f5) | 0;
  const next = t;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  const value = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  return { value, state: next };
}

/** Return an integer in [0, maxExclusive) plus the next state. */
export function nextInt(
  state: number,
  maxExclusive: number
): { value: number; state: number } {
  const { value, state: next } = nextFloat(state);
  return { value: Math.floor(value * maxExclusive), state: next };
}

/** Fisher–Yates shuffle returning a new array and the advanced state. */
export function shuffle<T>(
  state: number,
  array: readonly T[]
): { value: T[]; state: number } {
  const result = array.slice();
  let s = state;
  for (let i = result.length - 1; i > 0; i--) {
    const roll = nextInt(s, i + 1);
    s = roll.state;
    const j = roll.value;
    const tmp = result[i]!;
    result[i] = result[j]!;
    result[j] = tmp;
  }
  return { value: result, state: s };
}
