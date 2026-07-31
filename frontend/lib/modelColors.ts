import { PALETTE } from "./palette";

// Fixed slug -> slot mapping, in the model registry's own seed order (backend/app/seed.py) --
// NOT selection order. "Color follows the entity, never repaint the survivors": removing one
// model from a comparison must not shift another model's color to fill the gap, and a model
// must render the same color across every comparison view in the app.
//
// Slot 1 (blue) is permanently reserved for Actual (matches ForecastChart.tsx's existing
// single-experiment convention) and is excluded from the model rotation below.
const MODEL_COLOR_ORDER = [
  "tensor_ar",
  "sarima",
  "ets",
  "dlinear",
  "itransformer",
  "timexer",
  "timemixer",
] as const;

const SLOT_HUES = ["orange", "aqua", "yellow", "magenta", "green", "violet", "red"] as const;

// 7 models = exactly the 7 non-Actual palette slots -- no headroom for an 8th today. An unknown
// slug (a future 8th model) falls back to neutral gray rather than cycling/reusing a hue, which
// the dataviz skill calls out as an explicit anti-pattern (a reused hue is indistinguishable
// from the original under CVD).
export function getModelColor(slug: string, isDark: boolean): string {
  const p = isDark ? PALETTE.dark : PALETTE.light;
  const idx = MODEL_COLOR_ORDER.indexOf(slug as (typeof MODEL_COLOR_ORDER)[number]);
  if (idx === -1) return p.secondary;
  return p[SLOT_HUES[idx]];
}

export function getActualColor(isDark: boolean): string {
  const p = isDark ? PALETTE.dark : PALETTE.light;
  return p.blue;
}
