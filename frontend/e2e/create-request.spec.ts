import { expect, test } from "@playwright/test";

test("login and create shows share link", async ({ page }) => {
  await page.goto("/login");
  await page.getByTestId("login-email").fill("alice_create@example.test");
  await page.getByTestId("login-submit").click();
  await expect(page.getByRole("heading", { name: "Payment requests" })).toBeVisible({
    timeout: 15_000,
  });
  await page.getByTestId("create-recipient").fill("bob_create@example.test");
  await page.getByTestId("create-amount").fill("5.00");
  await page.getByTestId("create-submit").click();
  await expect(page.getByText("Request created successfully!")).toBeVisible({ timeout: 15_000 });
  const shareInput = page.getByTestId("create-share-url");
  await expect(shareInput).toBeVisible();
  await expect(shareInput).toHaveValue(/\/requests\//);
});
