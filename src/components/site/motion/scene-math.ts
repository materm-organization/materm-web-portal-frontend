// Pure math behind useSceneStates / useStateOpacity (no React, unit-testable).

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

/** Ease in-out used between two held states (smootherstep). */
export const easeInOut = (t: number) => {
  const x = clamp01(t);
  return x * x * x * (x * (x * 6 - 15) + 10);
};

/**
 * Index of the state a scene is currently "at" (nearest state).
 * States are equally spaced over progress 0..1.
 */
export function sceneStateIndex(progress: number, n: number): number {
  if (n <= 1) return 0;
  return Math.round(clamp01(progress) * (n - 1));
}

/**
 * Interpolated value `valueIndex` of a scene at `progress`.
 * `states` = N states x M values. Between two consecutive states the value
 * holds for `holdRatio / 2` of the segment at each end, and eases in the
 * middle `1 - holdRatio` of it.
 */
export function sceneValueAt(
  progress: number,
  states: number[][],
  valueIndex: number,
  holdRatio = 0.25,
): number {
  const n = states.length;
  if (n === 0) return 0;
  if (n === 1) return states[0][valueIndex];
  const x = clamp01(progress) * (n - 1);
  const seg = Math.min(Math.floor(x), n - 2);
  const local = x - seg;
  const hold = Math.min(Math.max(holdRatio, 0), 0.98);
  const t = easeInOut((local - hold / 2) / (1 - hold));
  const a = states[seg][valueIndex];
  const b = states[seg + 1][valueIndex];
  return a + (b - a) * t;
}

/**
 * Opacity (0..1) of a caption tied to state `index` of `n`. 1 while the scene
 * holds that state, linear cross-fade (sums to 1 with the neighbour) in between.
 */
export function stateOpacityAt(
  progress: number,
  index: number,
  n: number,
  holdRatio = 0.25,
): number {
  if (n <= 1) return 1;
  const d = Math.abs(clamp01(progress) * (n - 1) - index);
  const hold = Math.min(Math.max(holdRatio, 0), 0.98);
  const full = hold / 2;
  const fadeEnd = 1 - hold / 2;
  if (d <= full) return 1;
  if (d >= fadeEnd) return 0;
  return 1 - (d - full) / (fadeEnd - full);
}
