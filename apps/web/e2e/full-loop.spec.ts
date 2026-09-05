import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { PNG } from "pngjs";
import { parseOrbitscarContent } from "@orbitscar/content";
import { authoritativeDigest, createColony } from "@orbitscar/simulation";
import { act, boot, deployWave, freshColony, metrics, navTo, tapWorld, waitForBattleEnd } from "./helpers.js";

const content = parseOrbitscarContent(JSON.parse(readFileSync(new URL("../../../packages/content/data/orbitscar-v0/balance.json", import.meta.url), "utf8")));

test.describe.serial("Orbitscar vertical slice", () => {
  let errors: string[];

  test.beforeEach(async ({ page }) => {
    errors = [];
    page.on("pageerror", (error) => errors.push("pageerror: " + String(error)));
    page.on("console", (message) => { if (message.type() === "error" && !message.text().includes("favicon")) errors.push("console: " + message.text()); });
  });

  test.afterEach(async () => {
    expect(errors, "no page or console errors").toEqual([]);
  });

  async function colonyState(page: Page) {
    const raw = await page.evaluate(() => localStorage.getItem("orbitscar_colony_v3"));
    expect(raw, "a colony save exists").toBeTruthy();
    return JSON.parse(raw as string).payload;
  }

  async function trainAndSave(page: Page): Promise<void> {
    for (let i = 0; i < 9; i++) await act(page, "train:line_rigger");
    for (let i = 0; i < 3; i++) await act(page, "train:pulse_marksman");
    for (let i = 0; i < 2; i++) await act(page, "train:needle_drone");
  }

  test("desktop: colony economy, construction, upgrade, training", async ({ page }) => {
    await freshColony(page);
    expect(await metrics(page)).toContain("ALLOY 500");
    await act(page, "collect");
    expect(await metrics(page)).toContain("ALLOY 530");
    // construct a second extractor on an open plinth cell via the tactical canvas
    await act(page, "build:matter_extractor");
    await tapWorld(page, { x: 620, y: 500 });
    const afterBuild = await colonyState(page);
    expect(afterBuild.buildings).toHaveLength(3);
    expect(afterBuild.resources.alloy).toBeLessThan(530);
    // upgrade the original extractor
    await act(page, "upgrade:matter-extractor-1");
    const afterUpgrade = await colonyState(page);
    expect(afterUpgrade.resources.alloy).toBeLessThan(afterBuild.resources.alloy);
    expect(afterUpgrade.buildings.find((building: { id: string }) => building.id === "matter-extractor-1")?.level).toBe(2);
    // training consumes resources and fills reserves
    await trainAndSave(page);
    const trained = await colonyState(page);
    expect(trained.reserves).toEqual({ line_rigger: 9, pulse_marksman: 3, needle_drone: 2 });
  });

  test("deployment capacity: over-capacity force is refused by the client", async ({ page }) => {
    await freshColony(page);
    for (let i = 0; i < 6; i++) await act(page, "train:ram_walker"); // 6 × 4 capacity = 24
    await navTo(page, "targets");
    await act(page, "scout:cinder-yard");
    await navTo(page, "army");
    await act(page, "army:+:ram_walker");
    await act(page, "army:+:ram_walker");
    expect(await page.locator('[data-action="army:+:ram_walker"]').isDisabled(), "third walker would exceed the 10-capacity budget").toBe(true);
  });

  test("desktop: full breach loop with three waves, ability, report, reconciliation", async ({ page }) => {
    await freshColony(page);
    await trainAndSave(page);
    const before = await colonyState(page);
    await navTo(page, "targets");
    await act(page, "scout:cinder-yard");
    await navTo(page, "army");
    for (let i = 0; i < 9; i++) await act(page, "army:+:line_rigger");
    await act(page, "begin-deployment");
    await deployWave(page, "west", 5); // 4 riggers
    await deployWave(page, "north", 2); // 3 riggers
    await deployWave(page, "south", 0); // 2 riggers
    // deployment charge contract: the fourth wave must be unavailable
    await expect(page.locator('[data-action="deploy-wave"]')).toBeDisabled();
    expect(await page.locator("section.content").innerText()).toMatch(/3 \/ 3 waves/i);
    await act(page, "ability");
    await act(page, "resolve-battle");
    await waitForBattleEnd(page);
    await act(page, "report");
    expect(await page.locator("section.content").innerText()).toMatch(/attempt attempt-/i);
    await act(page, "return-home");
    const settled = await colonyState(page);
    expect(settled.reports).toHaveLength(1);
    expect(settled.reports[0].attemptId).toMatch(/^attempt-/);
    const casualties = settled.reports[0].result.attackerCasualties.line_rigger ?? 0;
    expect(settled.reserves).toEqual({
      line_rigger: 9 - casualties,
      pulse_marksman: 3,
      needle_drone: 2,
    });
    expect(settled.resources.alloy).toBeGreaterThanOrEqual(before.resources.alloy);
    // persistence across reload: the settled state is stable and never applied twice
    await page.reload();
    const reloaded = await colonyState(page);
    expect(reloaded.reports).toHaveLength(1);
    expect(reloaded.reserves).toEqual(settled.reserves);
    expect(reloaded.resources).toEqual(settled.resources);
  });

  test("desktop: repeated attacks settle independently under unique attempt ids", async ({ page }) => {
    await freshColony(page);
    for (let i = 0; i < 12; i++) await act(page, "train:line_rigger");
    const attack = async () => {
      await navTo(page, "targets");
      await act(page, "scout:cinder-yard");
      await navTo(page, "army");
      for (let i = 0; i < 9; i++) await act(page, "army:+:line_rigger");
      await act(page, "begin-deployment");
      await deployWave(page, "west", 0);
      await act(page, "resolve-battle");
      await waitForBattleEnd(page);
      await act(page, "report");
      await act(page, "return-home");
    };
    await attack();
    const first = await colonyState(page);
    expect(first.reports.length).toBe(1);
    await attack();
    const second = await colonyState(page);
    expect(second.reports.length, "a second attack settles a second report").toBe(2);
    expect(new Set(second.reports.map((report: { attemptId: string }) => report.attemptId)).size, "each settlement has a unique attempt id").toBe(second.reports.length);
  });

  test("battle view: structure health bars visibly decrease during the replay", async ({ page }) => {
    await freshColony(page);
    for (let i = 0; i < 9; i++) await act(page, "train:line_rigger");
    await navTo(page, "targets");
    await act(page, "scout:cinder-yard");
    await navTo(page, "army");
    for (let i = 0; i < 9; i++) await act(page, "army:+:line_rigger");
    await act(page, "begin-deployment");
    await deployWave(page, "west", 0);
    await act(page, "resolve-battle");
    // rigger-only army keeps its blue off the health-bar cyan channel
    const countBarPixels = async (): Promise<number> => {
      // hide the DOM command surface: its own cyan meter overlaps the canvas clip
      await page.evaluate(() => { (document.querySelector("#ui-root") as HTMLElement).style.visibility = "hidden"; });
      const shot = await page.locator("canvas").screenshot();
      await page.evaluate(() => { (document.querySelector("#ui-root") as HTMLElement).style.visibility = ""; });
      const png = PNG.sync.read(shot);
      let cyan = 0;
      for (let i = 0; i < png.data.length; i += 4) {
        const [r, g, b, a] = [png.data[i], png.data[i + 1], png.data[i + 2], png.data[i + 3]];
        if (a > 200 && Math.abs(r - 142) < 28 && Math.abs(g - 230) < 25 && Math.abs(b - 209) < 25) cyan++;
      }
      return cyan;
    };
    await page.waitForTimeout(5000);
    const early = await countBarPixels();
    await page.locator("canvas").screenshot({ path: "test-results/bars-early.png" });
    await page.waitForTimeout(9000);
    const later = await countBarPixels();
    await page.locator("canvas").screenshot({ path: "test-results/bars-later.png" });
    expect(early, "health bars are painted").toBeGreaterThan(0);
    expect(later, "total health-bar pixels decrease as structures take damage").toBeLessThan(early);
  });

  test("retreat ends a battle early without salvage", async ({ page }) => {
    await freshColony(page);
    await act(page, "train:needle_drone");
    await navTo(page, "targets");
    await act(page, "scout:glass-spine");
    await navTo(page, "army");
    await act(page, "army:+:needle_drone");
    await act(page, "begin-deployment");
    await deployWave(page, "west", 0);
    await act(page, "resolve-battle");
    await page.waitForTimeout(2500);
    await act(page, "retreat");
    await waitForBattleEnd(page);
    await act(page, "report");
    expect(await page.locator("section.content").innerText()).toContain("Force withdrawn");
    await act(page, "return-home");
    const state = await colonyState(page);
    expect(state.reports[0].result.retreated).toBe(true);
    expect(state.reports[0].result.loot).toEqual({});
  });

  test("every authored encounter resolves with the commander ability armed", async ({ page }) => {
    await freshColony(page);
    for (let i = 0; i < 10; i++) await act(page, "train:line_rigger");
    for (const encounter of ["cinder-yard", "glass-spine", "quiet-orbit"]) {
      await navTo(page, "targets");
      await act(page, `scout:${encounter}`);
      await navTo(page, "army");
      for (let i = 0; i < 8; i++) await act(page, "army:+:line_rigger");
      await act(page, "begin-deployment");
      await deployWave(page, "north", 4);
      await act(page, "ability");
      await act(page, "resolve-battle");
      await page.waitForTimeout(1500);
      await act(page, "retreat");
      await waitForBattleEnd(page);
      await act(page, "report");
      await act(page, "return-home");
    }
    const state = await colonyState(page);
    expect(state.reports.length).toBeGreaterThanOrEqual(3);
  });

  test("persistence: v1 and v2 saves migrate; tampered saves fail safe", async ({ page }) => {
    // build valid legacy saves with correct digests, node-side
    const base = createColony("local-player", content);
    const v1Payload = JSON.parse(JSON.stringify(base));
    delete v1Payload.settings;
    const v1 = { schemaVersion: 1, payload: v1Payload, checksum: authoritativeDigest(v1Payload) };
    const v2Payload = JSON.parse(JSON.stringify(base));
    v2Payload.reports = [{ id: "report-1", createdAt: base.createdAt, result: { winner: "defender", victoryTier: "defeat", outcomeHash: "legacy-hash", loot: {} } }];
    const v2 = { schemaVersion: 2, payload: v2Payload, checksum: authoritativeDigest(v2Payload) };

    await page.goto("/");
    await page.evaluate(() => localStorage.clear());
    await page.evaluate(([v1, v2]) => {
      localStorage.setItem("orbitscar_colony_v1", v1 as string);
      localStorage.setItem("orbitscar_colony_v2", v2 as string);
    }, [JSON.stringify(v1), JSON.stringify(v2)] as const);
    await page.reload();
    await expect(page.locator("h1")).toHaveText("Home colony");
    const migratedInMemory = await page.evaluate(() => JSON.parse(localStorage.getItem("orbitscar_colony_v2") as string).payload);
    expect(migratedInMemory.resources.alloy, "v2 save wins the fallback chain and loads").toBe(500);
    // a legacy report gains an attempt id once the migrated colony is saved forward
    await act(page, "save");
    const migrated = await colonyState(page);
    expect(migrated.reports[0].attemptId, "legacy report gains an attempt id").toBe("report-1");
    expect(migrated.reports[0].id).toBe("report-1");
    expect(migrated.schemaVersion ?? 3).toBe(3);

    // a save whose payload no longer matches its checksum must fail safe, not crash
    await page.evaluate(([v1]) => {
      const save = JSON.parse(v1 as string);
      save.payload.resources.alloy = 999999;
      localStorage.setItem("orbitscar_colony_v3", JSON.stringify(save));
      localStorage.removeItem("orbitscar_colony_v2");
      localStorage.removeItem("orbitscar_colony_v1");
    }, [JSON.stringify(v2)] as const);
    await page.reload();
    await expect(page.locator("h1")).toHaveText("Home colony");
    await expect(page.locator(".metrics"), "tampered save discarded; fresh colony created").toContainText("ALLOY 500");
    await act(page, "save");
    const fresh = await colonyState(page);
    expect(fresh.resources.alloy).toBe(500);
  });

  test("mobile viewport: loop completes, no horizontal catastrophe, controls reachable", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await freshColony(page);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, "no horizontal overflow").toBeLessThanOrEqual(2);
    for (const action of ["colony", "targets", "army"]) {
      const box = await page.locator(`.nav [data-action="${action}"]`).boundingBox();
      expect(box, `nav ${action} inside viewport`).toBeTruthy();
      expect(box!.y).toBeGreaterThanOrEqual(0);
      expect(box!.y + box!.height).toBeLessThanOrEqual(844);
    }
    await act(page, "train:line_rigger");
    await navTo(page, "targets");
    await act(page, "scout:cinder-yard");
    await navTo(page, "army");
    await act(page, "army:+:line_rigger");
    await act(page, "begin-deployment");
    await deployWave(page, "west", 0);
    await act(page, "resolve-battle");
    await page.waitForTimeout(2500);
    await act(page, "retreat");
    await waitForBattleEnd(page);
    await act(page, "report");
    await act(page, "return-home");
    const state = await colonyState(page);
    expect(state.reports.length).toBe(1);
  });
});
