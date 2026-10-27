"use client";

import { useMemo } from "react";
import { transformValue, useTransform, type MotionValue } from "motion/react";

import { sceneStateIndex, sceneValueAt, stateOpacityAt } from "./scene-math";

export { sceneStateIndex };

export interface SceneStatesOptions {
  /** Fraction of each state-to-state segment spent holding (default 0.25). */
  holdRatio?: number;
}

/**
 * Turns a 0..1 scene progress into M smoothly interpolated values driven by
 * N keyframe states (`states[state][value]`). States are equally spaced and
 * each one holds briefly (`holdRatio`). Returns one MotionValue per value,
 * ready for `style={{ flexGrow: values[0] }}`.
 *
 * `states` may be an inline literal; it is compared by content.
 */
export function useSceneStates(
  progress: MotionValue<number>,
  states: number[][],
  { holdRatio = 0.25 }: SceneStatesOptions = {},
): MotionValue<number>[] {
  const key = JSON.stringify(states);
  return useMemo(() => {
    const parsed = JSON.parse(key) as number[][];
    const m = parsed[0]?.length ?? 0;
    return Array.from({ length: m }, (_, i) =>
      transformValue(() => sceneValueAt(progress.get(), parsed, i, holdRatio)),
    );
  }, [progress, key, holdRatio]);
}

/**
 * MotionValue that is 1 while the scene holds state `index` (of `n`) and 0
 * elsewhere, with a linear cross-fade between neighbours. For captions.
 */
export function useStateOpacity(
  progress: MotionValue<number>,
  index: number,
  n: number,
  { holdRatio = 0.25 }: SceneStatesOptions = {},
): MotionValue<number> {
  return useTransform(progress, (p) => stateOpacityAt(p, index, n, holdRatio));
}
