import chromium from "chromium";
import fs from "fs";
import { execSync } from "child_process";

export const getChromiumPath = () => {
  const candidates = [
    process.env.CHROMIUM_PATH,
    chromium.path,
    "/usr/bin/chromium-browser",
    "/usr/bin/chromium",
    "/usr/bin/google-chrome-stable",
    "/usr/bin/google-chrome",
    "/snap/bin/chromium",
  ].filter(Boolean);

  for (const p of candidates) {
    try {
      // 🛡️ AWS Stability Fix: Validate path doesn't look like a Windows path on Linux
      if (process.platform === "linux" && (p.includes("\\") || p.includes("C:"))) continue;

      if (fs.existsSync(p)) return p;
    } catch { }
  }

  const bins = [
    "chromium-browser",
    "chromium",
    "google-chrome-stable",
    "google-chrome",
  ];
  for (const b of bins) {
    try {
      const out = execSync(`which ${b}`, { encoding: "utf8" }).trim();
      if (out) return out;
    } catch { }
  }

  return null;
};
