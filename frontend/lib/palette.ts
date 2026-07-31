export interface PaletteMode {
  blue: string;
  orange: string;
  aqua: string;
  yellow: string;
  magenta: string;
  green: string;
  violet: string;
  red: string;
  surface: string;
  text: string;
  secondary: string;
  grid: string;
}

// The dataviz skill's validated categorical reference palette (8 slots, CVD-safe across all 8
// for adjacent-pair chart forms like multi-line/bar/stack). Shared by ForecastChart.tsx and
// ModelComparisonChart.tsx so both read from one source instead of duplicating hex values.
export const PALETTE: { light: PaletteMode; dark: PaletteMode } = {
  light: {
    blue: "#2a78d6",
    orange: "#eb6834",
    aqua: "#1baf7a",
    yellow: "#eda100",
    magenta: "#e87ba4",
    green: "#008300",
    violet: "#4a3aa7",
    red: "#e34948",
    surface: "#fcfcfb",
    text: "#0b0b0b",
    secondary: "#52514e",
    grid: "#e1e0d9",
  },
  dark: {
    blue: "#3987e5",
    orange: "#d95926",
    aqua: "#199e70",
    yellow: "#c98500",
    magenta: "#d55181",
    green: "#008300",
    violet: "#9085e9",
    red: "#e66767",
    surface: "#1a1a19",
    text: "#ffffff",
    secondary: "#c3c2b7",
    grid: "#2c2c2a",
  },
};

export function getPaletteMode(isDark: boolean): PaletteMode {
  return isDark ? PALETTE.dark : PALETTE.light;
}
