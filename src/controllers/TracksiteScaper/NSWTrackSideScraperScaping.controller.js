// NSW TrackSide Racing Results Scraper
// Mirrors Keno scraper pattern with robust error handling
import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import chromium from "chromium";
import TrackSideResult from "../../models/TrackSideResult.NSW.model.js";
import { exec } from "child_process";
import util from "util";
const execAsync = util.promisify(exec);

// ✅ Use stealth plugin but disable problematic evasions
const stealth = StealthPlugin();
stealth.enabledEvasions.delete("user-agent-override");
stealth.enabledEvasions.delete("navigator.plugins");
stealth.enabledEvasions.delete("navigator.webdriver");
puppeteer.use(stealth);

// Kill any existing Chromium/Chrome processes
const killZombieChromium = async () => {
  try {
    if (process.platform === "win32") {
      await execAsync(
        "taskkill /F /IM chrome.exe /T 2>nul & taskkill /F /IM chromium.exe /T 2>nul"
      );
    } else {
      await execAsync('pkill -f "chrome|chromium" || true');
    }
    console.log("🧹 NSW: Cleaned up zombie processes");
  } catch (err) {
    console.warn("⚠️ NSW: Could not kill processes:", err.message);
  }
};

// Safe close browser
const safeClose = async (browser) => {
  if (!browser) return;
  try {
    await browser.close();
  } catch (e) {
    await killZombieChromium();
  }
};

// Retry wrapper
const retry = async (fn, retries = 3, delay = 2000) => {
  let lastError;
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      console.warn(`⚠️ NSW Retry ${i + 1}/${retries} failed: ${err.message}`);
      if (i < retries - 1) await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw lastError;
};

// Launch browser with proxy
const launchBrowser = async (proxyUrl, proxyUser, proxyPass) => {
  let executablePath = process.env.CHROMIUM_PATH || chromium.path;
  console.log(`📍 NSW: Using executable path: ${executablePath}`);

  const args = [
    "--no-sandbox",
    "--disable-setuid-sandbox",
    "--disable-dev-shm-usage",
    `--proxy-server=${proxyUrl}`,
  ];

  let browser;
  try {
    browser = await puppeteer.launch({
      headless: true,
      executablePath,
      args,
    });
  } catch (launchErr) {
    console.warn(
      `⚠️ NSW: Launch with executablePath failed, trying without it. Error: ${launchErr.message}`
    );
    try {
      browser = await puppeteer.launch({
        headless: true,
        args,
      });
    } catch (fallbackErr) {
      console.error(
        `❌ NSW: Both launch attempts failed: ${fallbackErr.message}`
      );
      throw fallbackErr;
    }
  }

  const page = await browser.newPage();

  if (proxyUser && proxyPass) {
    await page.authenticate({ username: proxyUser, password: proxyPass });
  }

  await page.setUserAgent(
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) " +
    "AppleWebKit/537.36 (KHTML, like Gecko) " +
    "Chrome/124.0.0.0 Safari/537.36"
  );
  await page.setExtraHTTPHeaders({ "Accept-Language": "en-US,en;q=0.9" });

  return { browser, page };
};

// Main scraper function
export const scrapeTrackSideResults = async () => {
  const proxyHost = process.env.PROXY_HOST || "gw.dataimpulse.com";
  const proxyPort = process.env.PROXY_PORT || "823";
  const proxyUser = process.env.PROXY_USER_NSW;
  const proxyPass = process.env.PROXY_PASS_NSW;
  const proxyUrl = `http://${proxyHost}:${proxyPort}`;
  const targetUrl = "https://tabtrackside.com.au/results";
  const location = "NSW";

  const runScraperOnce = async () => {
    let browser, page;
    try {
      console.log("🚀 NSW: Launching browser...");
      ({ browser, page } = await launchBrowser(proxyUrl, proxyUser, proxyPass));

      // Navigation with retry for detached frame
      let navOk = false;
      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          console.log(
            `🌐 NSW: Navigating to ${targetUrl} (attempt ${attempt})...`
          );
          const response = await page.goto(targetUrl, {
            waitUntil: "domcontentloaded",
            timeout: 30000,
          });
          if (!response || !response.ok())
            throw new Error(`Bad response: ${response?.status()}`);
          navOk = true;
          break;
        } catch (err) {
          if (/detached/i.test(err.message)) {
            console.warn(
              `⚠️ NSW: Navigation failed (detached frame) attempt ${attempt}`
            );
            await safeClose(browser);
            ({ browser, page } = await launchBrowser(
              proxyUrl,
              proxyUser,
              proxyPass
            ));
            continue;
          }
          throw err;
        }
      }
      if (!navOk) throw new Error("Navigation failed after retries");

      // Check for block/restriction
      const bodyText = await page.evaluate(() => document.body.innerText);
      if (/Access Denied|blocked|verify|cloudflare/i.test(bodyText)) {
        throw new Error("Blocked by WAF or access denied");
      }

      await new Promise((r) => setTimeout(r, 2000));

      // Wait for game results to appear
      await retry(() =>
        page.waitForSelector(
          'div[data-testid^="results-row-wrapper-"]',
          { timeout: 15000 }
        )
      );

      // Extract game results
      const results = await page.evaluate(() => {
        const containers = Array.from(document.querySelectorAll('div[data-testid^="results-row-wrapper-"]'));
        const gameResults = [];

        containers.forEach((element) => {
          try {
            // Extract Game Name (e.g., "Game 765")
            const gameNameEl = element.querySelector('span[data-testid^="result-game-number-"]');
            const gameName = gameNameEl ? gameNameEl.textContent.trim() : "";

            // Extract Runners (Numbers)
            // The runners are in spans with data-testid="runner-X"
            const runnerEls = element.querySelectorAll('span[data-testid^="runner-"]');
            let numbers = Array.from(runnerEls)
              .map((n) => parseInt(n.textContent.trim(), 10))
              .filter((n) => !isNaN(n));

            // Deduplicate (since they appear in summary and details)
            numbers = Array.from(new Set(numbers));

            if (gameName && numbers.length > 0) {
              // Check if already added
              const exists = gameResults.some(g => g.gameName === gameName);
              if (!exists) {
                gameResults.push({
                  gameName,
                  numbers,
                  timestamp: new Date().toISOString(),
                });
              }
            }
          } catch (e) { }
        });

        return gameResults;
      });

      console.log(`✅ NSW: Found ${results.length} game results`);

      if (results.length === 0) {
        throw new Error(
          "No game results extracted from page (selector mismatch?)"
        );
      }

      // Save to DB
      let savedCount = 0;
      for (const result of results) {
        try {
          const gameId = `${result.gameName}_${result.numbers.join("_")}`;
          const filter = { gameId, location };
          const update = {
            gameId,
            gameName: result.gameName,
            numbers: result.numbers,
            location,
            date: new Date().toISOString().split("T")[0],
            timestamp: new Date(),
            scraperVersion: "2.0",
          };

          const savedDoc = await TrackSideResult.findOneAndUpdate(
            filter,
            update,
            { upsert: true, new: true, setDefaultsOnInsert: true }
          );

          if (savedDoc) {
            console.log(
              `✅ NSW: Saved ${result.gameName
              } - Numbers: ${result.numbers.join(",")}`
            );
            savedCount++;
          }
        } catch (dbErr) {
          console.error(
            `❌ NSW: DB Error saving ${result.gameName}:`,
            dbErr.message
          );
        }
      }

      console.log(
        `✅ NSW: ${savedCount}/${results.length} results saved to DB`
      );
      await safeClose(browser);
      return results;
    } catch (err) {
      console.error("❌ NSW runScraperOnce failed:", err.message);
      await safeClose(browser);
      throw err;
    }
  };

  // Outer retry for full scraper
  return await retry(
    async () => {
      await killZombieChromium();
      return await runScraperOnce();
    },
    3,
    5000
  );
};

// Wrapped version with retry
export const scrapeTrackSideResultsWithRetry = () => {
  return scrapeTrackSideResults();
};

// Get latest results from database
export const getLatestTrackSideResults = async (
  location = "NSW",
  limit = 10
) => {
  try {
    const results = await TrackSideResult.find({ location })
      .sort({ timestamp: -1 })
      .limit(limit)
      .lean();
    return results;
  } catch (err) {
    console.error("❌ NSW: Error fetching TrackSide results:", err.message);
    return [];
  }
};
