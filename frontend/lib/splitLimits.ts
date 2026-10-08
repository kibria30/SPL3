// Slider ranges for the period-based split, derived from the selected dataset's size so the
// bars only offer splits the data can actually hold (at least MIN_TRAIN_PERIODS of training data left).
const MIN_TEST_PERIODS = 3;
const MAX_TEST_PERIODS = 25;
const MAX_INPUT_PERIODS = 20;
const MIN_TRAIN_PERIODS = 3;

export interface SplitLimits {
  testMin: number;
  testMax: number;
  inputMin: number;
  inputMax: (testPeriods: number) => number;
  fits: boolean; // false when the dataset is too short for even the smallest test window
}

export function getSplitLimits(rows: number, periodLength: number): SplitLimits {
  const totalPeriods = Math.floor(rows / periodLength);
  const testMax = Math.min(MAX_TEST_PERIODS, totalPeriods - MIN_TRAIN_PERIODS);
  return {
    testMin: MIN_TEST_PERIODS,
    testMax: Math.max(testMax, MIN_TEST_PERIODS),
    inputMin: 1,
    inputMax: (testPeriods) => Math.min(MAX_INPUT_PERIODS, testPeriods - 1),
    fits: testMax >= MIN_TEST_PERIODS,
  };
}

export function clampToLimits(testPeriods: number, inputPeriods: number, limits: SplitLimits) {
  const test = Math.min(Math.max(testPeriods, limits.testMin), limits.testMax);
  const input = Math.min(Math.max(inputPeriods, limits.inputMin), limits.inputMax(test));
  return { test, input };
}
