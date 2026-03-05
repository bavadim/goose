import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { expect, test } from "@playwright/test";
import type { ElectronApplication, Page } from "playwright";
import { _electron as electron } from "playwright";

test.describe("MUST desktop runtime requirements", () => {
  const waitForDesktopWindow = async (
    app: ElectronApplication,
  ): Promise<Page> => {
    const firstWindow =
      app.windows()[0] ??
      (await Promise.race([
        app.firstWindow(),
        new Promise<never>((_resolve, reject) => {
          setTimeout(() => reject(new Error("First window timeout")), 10_000);
        }),
      ]));

    const deadline = Date.now() + 20_000;
    while (Date.now() < deadline) {
      const pages = [firstWindow, ...app.windows()].filter(
        (page, index, array) => array.indexOf(page) === index,
      );
      for (const page of pages) {
        await page.waitForLoadState("domcontentloaded", { timeout: 2_000 });
        const heading = page.getByRole("heading", { name: "Agent Desktop" });
        if (await heading.isVisible({ timeout: 500 })) {
          return page;
        }
      }
      await new Promise((resolve) => setTimeout(resolve, 200));
    }

    const diagnostics = await app.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows().map((window) =>
        window.webContents.getURL(),
      ),
    );
    throw new Error(
      `Desktop window did not become ready: ${diagnostics.join(", ")}`,
    );
  };

  test("MUST start embedded backend and show ready status", async () => {
    const configRoot = fs.mkdtempSync(path.join(os.tmpdir(), "agent-e2e-"));
    const backendPort = 41000 + Math.floor(Math.random() * 500);
    const appEnv = {
      ...process.env,
      XDG_CONFIG_HOME: configRoot,
      AGENT_DESKTOP_BACKEND_PORT: String(backendPort),
    };

    const app = await electron.launch({
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        path.resolve("dist-electron/main.js"),
      ],
      env: appEnv,
    });

    try {
      const page = await waitForDesktopWindow(app);
      await expect(page.getByTestId("backend-status")).toContainText(
        `Backend status: ready (http://127.0.0.1:${backendPort})`,
      );
    } finally {
      await app.close();
      fs.rmSync(configRoot, { recursive: true, force: true });
    }
  });
});
