import { expect, type Page } from "@playwright/test";

export const ARENA = { width: 1200, height: 800 };

export async function freshColony(page: Page): Promise<void> {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await expect(page.locator("h1")).toHaveText("Home colony");
}

export async function boot(page: Page): Promise<void> {
  await page.goto("/");
  await expect(page.locator("h1")).toBeVisible();
}

/** The app re-renders its DOM after every action, so every click resolves a fresh locator. */
export async function act(page: Page, action: string): Promise<void> {
  const button = page.locator(`[data-action="${action}"]`);
  await button.waitFor({ state: "attached" });
  await expect(button).toBeEnabled();
  await button.click();
}

/** Navigate via the top bar; nav actions collide with same-action content buttons. */
export async function navTo(page: Page, mode: "colony" | "targets" | "army"): Promise<void> {
  const button = page.locator(`.nav [data-action="${mode}"]`);
  await button.waitFor({ state: "attached" });
  await button.click();
}

/** Canvas mapping: camera centers the arena and zooms to fit; match scene.ts behavior. */
export function worldToScreen(viewport: { width: number; height: number }, world: { x: number; y: number }): { x: number; y: number } {
  const zoom = Math.max(0.55, Math.min(1.5, Math.min(viewport.width / ARENA.width, viewport.height / ARENA.height)));
  return {
    x: (world.x - ARENA.width / 2) * zoom + viewport.width / 2,
    y: (world.y - ARENA.height / 2) * zoom + viewport.height / 2,
  };
}

export async function tapWorld(page: Page, world: { x: number; y: number }): Promise<void> {
  const canvas = page.locator("canvas");
  const box = await canvas.boundingBox();
  if (!box) throw new Error("canvas missing");
  const screen = worldToScreen(page.viewportSize() ?? { width: 1280, height: 720 }, world);
  await page.mouse.click(box.x + screen.x, box.y + screen.y);
}

export async function notice(page: Page): Promise<string> {
  return (await page.locator("[role=status]").first().textContent()) ?? "";
}

export async function statusText(page: Page): Promise<string> {
  return (await page.locator("[role=status]").last().textContent()) ?? "";
}

export async function metrics(page: Page): Promise<string> {
  return (await page.locator(".metrics").textContent()) ?? "";
}

/** Stage a wave from the current draft on the given approach. */
export async function deployWave(page: Page, zone: "west" | "north" | "south" | "east", holdBack: number): Promise<void> {
  if (zone !== "west") await act(page, `zone:${zone}`);
  for (let i = 0; i < holdBack; i++) await act(page, "wave:-:line_rigger");
  await act(page, "deploy-wave");
}

export async function waitForBattleEnd(page: Page): Promise<void> {
  const reportButton = page.locator('[data-action="report"]');
  await expect.poll(async () => (await reportButton.getAttribute("disabled")) === null, { timeout: 120_000, intervals: [1_000, 2_000, 5_000] }).toBe(true);
}

export async function pageErrors(page: Page): Promise<string[]> {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(String(error)));
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  return errors;
}
