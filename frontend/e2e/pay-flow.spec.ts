import { expect, test, type BrowserContext } from "@playwright/test";

test("recipient pays after sender creates", async ({ browser }) => {
  let sender: BrowserContext | undefined;
  let recipient: BrowserContext | undefined;

  try {
    sender = await browser.newContext({ recordVideo: { dir: "test-results/pay-flow-sender/" } });
    recipient = await browser.newContext({ recordVideo: { dir: "test-results/pay-flow-recipient/" } });

    const pSender = await sender.newPage();
    const pRec = await recipient.newPage();

    await pSender.goto("/login");
    await pSender.getByTestId("login-email").fill("sender_pay@example.test");
    await pSender.getByTestId("login-submit").click();
    await expect(pSender.getByRole("heading", { name: "Payment requests" })).toBeVisible({
      timeout: 15_000,
    });
    await pSender.getByTestId("create-recipient").fill("recipient_pay@example.test");
    await pSender.getByTestId("create-amount").fill("12.00");
    await pSender.getByTestId("create-submit").click();
    await expect(pSender.getByText("Request created successfully!")).toBeVisible({ timeout: 15_000 });
    const shareInput = pSender.getByTestId("create-share-url");
    await expect(shareInput).toBeVisible();
    const url = await shareInput.inputValue();
    const m = url.match(/requests\/([0-9a-f-]{36})/i);
    if (!m) throw new Error("No request id in share URL");
    const id = m[1];

    await pRec.goto("/login");
    await pRec.getByTestId("login-email").fill("recipient_pay@example.test");
    await pRec.getByTestId("login-submit").click();
    await expect(pRec.getByRole("heading", { name: "Payment requests" })).toBeVisible({
      timeout: 15_000,
    });
    await pRec.goto(`/requests/${id}`);
    await expect(pRec.getByTestId("pay-btn")).toBeEnabled({ timeout: 10_000 });
    await pRec.getByTestId("pay-btn").click();
    await pRec.getByRole("button", { name: "Confirm pay" }).click();
    await expect(pRec.getByText(/paid/i)).toBeVisible({ timeout: 15_000 });

    await pSender.goto("/");
    await pSender.goto(`/requests/${id}`);
    await expect(pSender.getByText(/paid/i)).toBeVisible({ timeout: 10_000 });
  } finally {
    await sender!.close();
    await recipient!.close();
  }
});
