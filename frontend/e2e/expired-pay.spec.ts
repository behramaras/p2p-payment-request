import { expect, test } from "@playwright/test";

test("expired request cannot be paid", async ({ page }) => {
  await page.goto("/login");
  await page.getByTestId("login-email").fill("expired_user@example.test");
  await page.getByTestId("login-submit").click();
  await expect(page.getByRole("heading", { name: "Payment requests" })).toBeVisible({
    timeout: 15_000,
  });

  const seedExpiredRes = await page.context().request.post("http://localhost:8000/api/test/seed-expired");
  if (!seedExpiredRes.ok()) test.skip();
  const body = (await seedExpiredRes.json()) as { id: string };
  await page.goto(`/requests/${body.id}`);
  await expect(page.getByTestId("pay-btn")).toBeDisabled();
});
