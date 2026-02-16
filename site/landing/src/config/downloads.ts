export type DownloadLink = {
  id: "macos-arm64" | "macos-x64" | "windows-x64";
  label: string;
  assetName: string;
  minSystem: string;
  iconClass: string;
};

const ASSETS: DownloadLink[] = [
  {
    id: "macos-arm64",
    label: "Скачать для macOS (Apple Silicon)",
    assetName: "InsightStream-goose-macos-arm64.zip",
    minSystem: "macOS 13+ (Apple Silicon)",
    iconClass: "bi-apple"
  },
  {
    id: "macos-x64",
    label: "Скачать для macOS (Intel)",
    assetName: "InsightStream-goose-macos-x64.zip",
    minSystem: "macOS 13+ (Intel)",
    iconClass: "bi-apple"
  },
  {
    id: "windows-x64",
    label: "Скачать для Windows (x64)",
    assetName: "InsightStream-goose-windows-x64.zip",
    minSystem: "Windows 10/11 (x64)",
    iconClass: "bi-windows"
  }
];

export function buildDownloadLinks(owner: string, repo: string): Array<DownloadLink & { url: string }> {
  const base = `https://github.com/${owner}/${repo}/releases/download/stable`;
  return ASSETS.map((asset) => ({
    ...asset,
    url: `${base}/${asset.assetName}`
  }));
}
