import { expect, test } from "@playwright/test";

test.describe("judge journey", () => {
  test("planner optimises and retask shows COAs", async ({ page }) => {
    await page.goto("/login");
    await page.getByRole("button", { name: /Ops Planner|planner/i }).click();
    await page.waitForURL(/\/app/);

    await page.goto("/app/plan");
    await page.getByRole("button", { name: "Optimise" }).click();
    await expect(page.getByText(/valid|PLN-/i)).toBeVisible({ timeout: 60_000 });

    await page.goto("/app/retask");
    await page.getByRole("button", { name: /Inject disruption/i }).click();
    await expect(page.getByText(/COA|courses of action|distinct/i)).toBeVisible({ timeout: 90_000 });
  });
});
