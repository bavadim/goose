// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DesktopApp } from "../src/desktop/renderer/ui/desktopApp.js";
import type { DesktopApi } from "../src/desktop/shared/api.js";

const makeApi = (overrides?: Partial<Awaited<ReturnType<DesktopApi["getState"]>>>): DesktopApi => ({
  invoke: vi.fn(
    async () =>
      ({ ok: true, data: undefined }) as {
        ok: true;
        data: never;
      },
  ) as DesktopApi["invoke"],
  send: vi.fn(),
  on: vi.fn(() => () => {}),
  getState: vi.fn(async () => ({
    backendUrl: "http://127.0.0.1:3001",
    backendError: "",
    windowsPreflightMessages: [],
    appDirs: null,
    isDev: true,
    ...overrides,
  })),
  sendLogs: vi.fn(async () => ({ ok: true, message: "ok" })),
  sendMessage: vi.fn(
    async () =>
      ({
        ok: true,
        data: { accepted: true },
      }) as const,
  ),
  subscribeMessages: vi.fn(() => () => {}),
  rendererReady: vi.fn(),
});

describe("MUST desktop runtime UI requirements", () => {
  afterEach(() => {
    cleanup();
  });

  it("MUST render backend ready state from desktop API", async () => {
    render(<DesktopApp desktopApi={makeApi()} />);

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Agent Desktop" })).toBeVisible();
    });

    expect(screen.getByTestId("backend-status")).toHaveTextContent(
      "Backend status: ready (http://127.0.0.1:3001)",
    );
  });

  it("MUST render backend error state from desktop API", async () => {
    render(
      <DesktopApp
        desktopApi={makeApi({ backendUrl: "", backendError: "Backend health check timed out" })}
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId("backend-status")).toHaveTextContent(
        "Backend status: error (Backend health check timed out)",
      );
    });
  });
});
