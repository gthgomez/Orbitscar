// Local solo opening sortie. No debug grants, clock changes or save injection.
import { execFileSync } from 'node:child_process';
import { mkdir, rename, rm, writeFile } from 'node:fs/promises';
import { chromium, expect } from '@playwright/test';

const output = 'docs/showcase';
await mkdir(`${output}/raw`, { recursive: true });
await rm(`${output}/capture.json`, { force: true });
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium',
  // Phaser.AUTO uses its supported Canvas fallback on this headless machine.
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-webgl'],
});
const context = await browser.newContext({ viewport: { width: 1280, height: 800 },
  recordVideo: { dir: `${output}/raw`, size: { width: 1280, height: 800 } } });
const page = await context.newPage();
page.setDefaultTimeout(15000);
const errors = [];
page.on('pageerror', error => errors.push(error.message));
const act = async action => {
  const button = page.locator(`[data-action="${action}"]`).last();
  if (!(await button.isVisible())) {
    const summary = page.locator('details.colony-operations > summary');
    if (await summary.isVisible()) await summary.click();
  }
  await expect(button).toBeVisible();
  await expect(button).toBeEnabled();
  await button.click();
  await expect(page.locator('.shell')).toHaveAttribute('data-authority-busy', 'false');
};
const shot = async name => {
  await page.waitForTimeout(850);
  await page.screenshot({ path: `${output}/${name}.png` });
};
try {
  await page.goto(process.env.SHOWCASE_URL || 'http://127.0.0.1:4182');
  await expect(page.locator('h1')).toHaveText('Home colony');
  await page.waitForTimeout(3000);
  await shot('01-colony');
  await act('build:arc_projector');
  const box = await page.locator('canvas').boundingBox();
  if (!box) throw new Error('Canvas has no bounds');
  // The arena is 1200x800 and centered at zoom=1 in a 1280x800 viewport.
  await page.mouse.click(box.x + 660, box.y + 120);
  for (let i = 0; i < 3; i++) await act('train:line_rigger');
  await act('targets');
  await act('scout:cinder-yard');
  await shot('02-scout');
  await page.locator('.nav [data-action="army"]').click();
  for (let i = 0; i < 3; i++) await act('army:+:line_rigger');
  await shot('03-force');
  await act('begin-deployment');
  await act('deploy-wave');
  await act('resolve-battle');
  await page.waitForTimeout(2200);
  await shot('04-breach');
  // Capture the real renderer layer without the DOM panel, explicitly labeled
  // as such in the README. Reading pixels does not change gameplay or the UI.
  const canvas = page.locator('canvas');
  const renderer = await canvas.evaluate(async element => {
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    return element.toDataURL('image/png').split(',')[1];
  });
  await writeFile(`${output}/04-breach-renderer.png`, Buffer.from(renderer, 'base64'));
  await expect(page.locator('[data-action="report"]')).toBeEnabled({ timeout: 120000 });
  await act('report');
  await shot('05-report');
  await page.waitForTimeout(1400);
  expect(errors).toEqual([]);
  await writeFile(`${output}/capture.json`, JSON.stringify({
    revision: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
    capturedAt: new Date().toISOString(), browser: browser.version(),
    viewport: { width: 1280, height: 800 }, pageErrors: errors,
    fixture: 'Fresh solo local save; Cinder Yard opening sortie; Phaser Canvas fallback (--disable-webgl); no authority profile, save injection or debug progression',
    verified: ['home rendered', 'defense placed through canvas', 'three Line Riggers trained', 'target scouted', 'army composed', 'live battle resolved', 'report opened'],
  }, null, 2) + '\n');
} finally {
  const video = page.video();
  await context.close();
  if (video) await rename(await video.path(), `${output}/raw/session.webm`);
  await browser.close();
}
