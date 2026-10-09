import fs from "node:fs";
import path from "node:path";

/** Writes a CSV with a `date` column plus numeric columns; returns the file path. */
export function writeCsv(
  dir: string,
  { name = "series.csv", rows = 150, columns = ["alpha", "beta", "gamma"] } = {},
) {
  fs.mkdirSync(dir, { recursive: true });
  const lines = [["date", ...columns].join(",")];
  for (let i = 0; i < rows; i++) {
    const d = new Date(Date.UTC(2010, i, 1)).toISOString().slice(0, 10);
    const vals = columns.map((_, c) => (10 + c * 5 + 4 * Math.sin((2 * Math.PI * i) / 12 + c) + i * 0.05).toFixed(3));
    lines.push([d, ...vals].join(","));
  }
  const file = path.join(dir, name);
  fs.writeFileSync(file, lines.join("\n") + "\n");
  return file;
}

export function writeRaw(dir: string, name: string, content: string) {
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, name);
  fs.writeFileSync(file, content);
  return file;
}
