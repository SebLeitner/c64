import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";

const infrastructure = await readFile(
  new URL("../../infra/main.tf", import.meta.url),
  "utf8",
);
const csp = infrastructure.match(/content_security_policy = "([^"]+)"/)[1];
test.beforeEach(async ({ page }) => {
  await page.route("http://127.0.0.1:4173/**", async (route) => {
    const response = await route.fetch();
    await route.fulfill({
      response,
      headers: { ...response.headers(), "content-security-policy": csp },
    });
  });
});

async function typeBasic(page, text) {
  await page.locator(".mobile-input").evaluate((element) => {
    element.open = true;
  });
  await page.getByLabel("BASIC-Zeilen oder Befehle").fill(text);
  await page.getByRole("button", { name: "EINGEBEN", exact: true }).click();
}

test("BASIC program saves through dialog, reloads locally and exports identical PRG", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await expect(page.locator("#boot")).toBeHidden({ timeout: 20_000 });
  await typeBasic(
    page,
    '10 PRINT "BROWSER TEST"\n20 FOR I=1 TO 3:PRINT I:NEXT\nSAVE "DEMO",8',
  );
  await expect(
    page.getByRole("dialog", { name: "Programm speichern" }),
  ).toBeVisible({ timeout: 20_000 });
  await page.getByLabel("Dateiname").fill("demo.prg");
  // Chromium headless exposes the native picker but cannot interact with its OS UI.
  // Exercise the supported download fallback in this test; native cancel is tested separately.
  await page.evaluate(() => {
    window.showSaveFilePicker = undefined;
  });
  const firstDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: "SPEICHERN", exact: true }).click();
  const first = await firstDownload;
  const original = await readFile(await first.path());
  expect(original[0] | (original[1] << 8)).toBe(0x801);
  expect(first.suggestedFilename()).toBe("demo.prg");
  await typeBasic(page, 'NEW\nLOAD "DEMO",8');
  await expect(
    page.getByRole("dialog", { name: "Programm laden" }),
  ).toBeVisible();
  await page
    .locator("#open-file")
    .setInputFiles({
      name: "demo.prg",
      mimeType: "application/octet-stream",
      buffer: original,
    });
  await page.getByRole("button", { name: "LADEN", exact: true }).click();
  await expect(page.locator("#status")).toContainText("Bytes geladen");
  await typeBasic(page, 'SAVE "KOPIE",8');
  await expect(
    page.getByRole("dialog", { name: "Programm speichern" }),
  ).toBeVisible();
  const secondDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: "SPEICHERN", exact: true }).click();
  const second = await secondDownload;
  expect(await readFile(await second.path())).toEqual(original);
  await page.locator("#screen").click();
  await page.keyboard.type("load", { delay: 90 });
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("dialog", { name: "Programm laden" }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.locator("#file-dialog")).not.toBeVisible();
  await page.getByRole("button", { name: "TON AUS" }).click();
  await expect(page.getByRole("button", { name: "TON AN" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page.screenshot({
    path: "test-results/c64-desktop.png",
    fullPage: true,
  });
  expect(errors).toEqual([]);
});

test("invalid file and native save cancellation keep dialogs recoverable; mobile layout fits", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.locator("#boot")).toBeHidden({ timeout: 20_000 });
  await page.getByRole("button", { name: "LOAD", exact: false }).click();
  await expect(page.locator("#file-dialog")).toBeVisible();
  await page
    .locator("#open-file")
    .setInputFiles({
      name: "bad.prg",
      mimeType: "application/octet-stream",
      buffer: Buffer.from([1]),
    });
  await page.getByRole("button", { name: "LADEN", exact: true }).click();
  await expect(page.locator("#file-error")).toContainText("Ladeadresse");
  await page.getByRole("button", { name: "ABBRECHEN" }).click();
  await typeBasic(page, '10 PRINT "OK"\nSAVE');
  await expect(
    page.getByRole("dialog", { name: "Programm speichern" }),
  ).toBeVisible();
  await page.evaluate(() => {
    window.showSaveFilePicker = async () => {
      throw new DOMException("cancel", "AbortError");
    };
  });
  await page.getByRole("button", { name: "SPEICHERN", exact: true }).click();
  await expect(page.locator("#file-error")).toContainText(
    "Speichern abgebrochen",
  );
  await page.getByRole("button", { name: "ABBRECHEN" }).click();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/c64-mobile.png",
    fullPage: true,
  });
});
