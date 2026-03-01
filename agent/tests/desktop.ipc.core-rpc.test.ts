import { describe, expect, it, vi } from "vitest";
import { createRpcHandlerMap } from "../src/desktop/ipc/main-transport.js";

const makeDependencies = () => ({
  getState: vi.fn(() => ({
    backendUrl: "http://127.0.0.1:43111",
    backendError: "",
    windowsPreflightMessages: [],
    appDirs: null,
    isDev: true,
  })),
  sendLogs: vi.fn(async () => ({ ok: true, message: "ok" })),
  getGoosedHostPort: vi.fn(() => "127.0.0.1:43111"),
  chooseDirectory: vi.fn(async () => ({
    canceled: false,
    filePaths: ["/tmp"],
  })),
  selectFileOrDirectory: vi.fn(async () => "/tmp/file.txt"),
  readFile: vi.fn(async () => ({
    file: "x",
    filePath: "/tmp/file.txt",
    error: null,
    found: true,
  })),
  writeFile: vi.fn(async () => true),
  ensureDirectory: vi.fn(async () => true),
  listFiles: vi.fn(async () => ["/tmp/a.md"]),
  getAllowedExtensions: vi.fn(() => [".md"]),
  openDirectoryInExplorer: vi.fn(async () => true),
  addRecentDir: vi.fn(() => true),
  openExternal: vi.fn(async () => undefined),
  fetchMetadata: vi.fn(async () => "text/html"),
  checkOllama: vi.fn(async () => true),
  sendClientMessage: vi.fn(async () => ({ accepted: true as const })),
});

describe("MUST desktop IPC core RPC requirements", () => {
  it("MUST support runtime compatibility RPC for desktop state and host port", async () => {
    const deps = makeDependencies();
    const handlers = createRpcHandlerMap(deps);

    expect(handlers["desktop:get-state"](undefined, {} as never)).toMatchObject(
      {
        backendUrl: "http://127.0.0.1:43111",
      },
    );
    expect(handlers["get-goosed-host-port"](undefined, {} as never)).toBe(
      "127.0.0.1:43111",
    );
  });

  it("MUST validate URL payloads for open-external and fetch-metadata", async () => {
    const deps = makeDependencies();
    const handlers = createRpcHandlerMap(deps);

    await expect(
      handlers["open-external"]({ url: "file:///etc/passwd" }, {} as never),
    ).rejects.toMatchObject({ code: "IPC_INVALID_INPUT" });

    await expect(
      handlers["fetch-metadata"]({ url: "not-a-url" }, {} as never),
    ).rejects.toMatchObject({ code: "IPC_INVALID_INPUT" });
  });

  it("MUST forward filesystem RPC payloads after validation", async () => {
    const deps = makeDependencies();
    const handlers = createRpcHandlerMap(deps);

    await expect(
      handlers["read-file"]({ filePath: "/tmp/a.txt" }, {} as never),
    ).resolves.toEqual({
      file: "x",
      filePath: "/tmp/file.txt",
      error: null,
      found: true,
    });
    await handlers["write-file"](
      { filePath: "/tmp/a.txt", content: "hello" },
      {} as never,
    );
    await handlers["ensure-directory"]({ dirPath: "/tmp/dir" }, {} as never);
    await handlers["list-files"](
      { dirPath: "/tmp", extension: ".md" },
      {} as never,
    );

    expect(deps.readFile).toHaveBeenCalledWith("/tmp/a.txt");
    expect(deps.writeFile).toHaveBeenCalledWith("/tmp/a.txt", "hello");
    expect(deps.ensureDirectory).toHaveBeenCalledWith("/tmp/dir");
    expect(deps.listFiles).toHaveBeenCalledWith("/tmp", ".md");
  });

  it("MUST return deterministic IPC_NOT_FOUND for unsupported RPC channel", async () => {
    const deps = makeDependencies();
    const handlers = createRpcHandlerMap(deps);

    expect(() => handlers["get-settings"](undefined, {} as never)).toThrow(
      "IPC channel is not implemented: get-settings",
    );
  });
});
