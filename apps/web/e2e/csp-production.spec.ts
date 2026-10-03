import { expect, test } from "@playwright/test";

test.describe("production CSP and hydration", () => {
  test("landing, login, and app have no CSP violations or console errors", async ({ page }) => {
    const violations: string[] = [];
    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });
    await page.addInitScript(() => {
      document.addEventListener("securitypolicyviolation", (event) => {
        (window as unknown as { __csp: string[] }).__csp = (window as unknown as { __csp?: string[] }).__csp ?? [];
        (window as unknown as { __csp: string[] }).__csp.push(`${event.violatedDirective}: ${event.blockedURI}`);
      });
    });

    await page.goto("/");
    await expect(page.getByRole("button", { name: "Murphy strikes" })).toBeVisible();
    await page.getByRole("button", { name: "Murphy strikes" }).click();
    await expect(page.getByText(/ADP moved|moved/i)).toBeVisible({ timeout: 5000 });

    await page.goto("/login");
    await expect(page.getByRole("heading", { name: "VYUHA" })).toBeVisible();

    const cspOnPage = await page.evaluate(() => (window as unknown as { __csp?: string[] }).__csp ?? []);
    violations.push(...cspOnPage);

    const noise = consoleErrors.filter(
      (line) =>
        !line.includes("Worker failed to load") &&
        !line.includes("favicon") &&
        !line.includes("DevTools"),
    );
    expect(violations, `CSP violations: ${violations.join("; ")}`).toEqual([]);
    expect(noise, `Console errors: ${noise.join("; ")}`).toEqual([]);
  });
});
