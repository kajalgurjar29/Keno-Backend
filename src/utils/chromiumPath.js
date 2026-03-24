import chromium from "chromium";
import fs from "fs";
import { execSync } from "child_process";

export const getChromiumPath = () => {
  const isWin = process.platform === "win32";
  const candidates = [
    process.env.CHROMIUM_PATH,
    chromium.path,
    isWin ? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" : "/usr/bin/google-chrome",
    isWin ? "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe" : "/usr/bin/google-chrome-stable",
    "/usr/bin/chromium-browser",
    "/usr/bin/chromium",
    "/snap/bin/chromium",
  ].filter(Boolean);

  for (const p of candidates) {
    try {
      // 🛡️ AWS Stability Fix: Validate path doesn't look like a Windows path on Linux
      if (process.platform === "linux" && (p.includes("\\") || p.includes("C:"))) continue;

      if (fs.existsSync(p)) return p;
    } catch { }
  }

  const bins = isWin ? ["chrome", "chromium"] : [
    "chromium-browser",
    "chromium",
    "google-chrome-stable",
    "google-chrome",
  ];

  for (const b of bins) {
    try {
      const command = isWin ? `where ${b}` : `which ${b}`;
      const out = execSync(command, { encoding: "utf8" }).split('\n')[0].trim();
      if (out && fs.existsSync(out)) return out;
    } catch { }
  }

  return null;
};

