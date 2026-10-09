import type { Page, Locator } from "@playwright/test";

/** Labels in this app are not linked to inputs; find the input inside the label's wrapper. */
export function fieldInput(page: Page, label: string | RegExp): Locator {
  return page.getByText(label, { exact: typeof label === "string" }).first().locator("..").locator("input").first();
}
export function fieldSelect(page: Page, label: string | RegExp): Locator {
  return page.getByText(label, { exact: typeof label === "string" }).first().locator("..").locator("select").first();
}
export const slider = (page: Page, n: 0 | 1) => page.locator("input[type=range]").nth(n);

export async function setSlider(page: Page, n: 0 | 1, value: number) {
  await slider(page, n).evaluate((el, v) => {
    const input = el as HTMLInputElement;
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
    setter.call(input, String(v));
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }, value);
}

export const modelTile = (page: Page, name: string | RegExp, role: "radio" | "checkbox" = "radio") =>
  page.getByRole(role, { name });

export const datasetSelect = (page: Page) => page.locator("select").first();

export async function chooseDataset(page: Page, nameRe: RegExp) {
  const sel = datasetSelect(page);
  const opt = sel.locator("option", { hasText: nameRe }).first();
  await sel.selectOption({ value: (await opt.getAttribute("value"))! });
}
