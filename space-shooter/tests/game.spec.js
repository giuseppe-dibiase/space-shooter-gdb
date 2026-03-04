import { test, expect } from '@playwright/test';

// Helper: wait for window.gameScene to be available
async function waitForScene(page) {
  await page.waitForFunction(() => window.gameScene != null, { timeout: 10000 });
}

test('Case 1 — HUD is visible below the notch (y >= 70px from canvas top)', async ({ page }) => {
  await page.goto('/');
  await waitForScene(page);

  const canvas = page.locator('canvas');
  const box = await canvas.boundingBox();
  expect(box).not.toBeNull();

  // Canvas should be visible (top-left within viewport)
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.y).toBeGreaterThanOrEqual(0);

  // The HUD scoreTxt y should be at least 70px from the top of the canvas
  const hudY = await page.evaluate(() => window.gameScene.scoreTxt.y);
  expect(hudY).toBeGreaterThanOrEqual(70);
});

test('Case 2 — No lasers fired without touch or keypress', async ({ page }) => {
  await page.goto('/');
  await waitForScene(page);

  // Wait 1 second with no interaction
  await page.waitForTimeout(1000);

  const laserCount = await page.evaluate(
    () => window.gameScene.lasers.getChildren().filter(l => l.active).length
  );
  expect(laserCount).toBe(0);
});

test('Case 3 — Lasers fire when touching the canvas', async ({ page }) => {
  await page.goto('/');
  await waitForScene(page);

  const canvas = page.locator('canvas');
  const box = await canvas.boundingBox();

  // Simulate touch (pointerdown) at center of canvas
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();

  // Hold for 800ms to allow at least one shot
  await page.waitForTimeout(800);

  const laserCount = await page.evaluate(
    () => window.gameScene.lasers.getChildren().length
  );

  await page.mouse.up();

  expect(laserCount).toBeGreaterThan(0);
});

test('Case 4 — Lasers fire when Space key is held', async ({ page }) => {
  await page.goto('/');
  await waitForScene(page);

  // Press and hold Space
  await page.keyboard.down('Space');
  await page.waitForTimeout(800);

  const laserCount = await page.evaluate(
    () => window.gameScene.lasers.getChildren().length
  );

  await page.keyboard.up('Space');

  expect(laserCount).toBeGreaterThan(0);
});
