// ACT TrackSide Racing Results Scraper
// Mirrors Keno scraper pattern with robust error handling
import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import chromium from "chromium";
import fs from "fs";
import { execSync } from "child_process";
import { getChromiumPath } from "../../utils/chromiumPath.js";
import TrackSideResult from "../../models/TrackSideResult.ACT.model.js";
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
    console.log("🧹 ACT: Cleaned up zombie processes");
  } catch (err) {
    console.warn("⚠️ ACT: Could not kill processes:", err.message);
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
      console.warn(`⚠️ ACT Retry ${i + 1}/${retries} failed: ${err.message}`);
      if (i < retries - 1) await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw lastError;
};

// Launch browser with proxy
const launchBrowser = async (proxyUrl, proxyUser, proxyPass) => {
  let executablePath = getChromiumPath() || null;
  console.log(`📍 ACT: Using executable path: ${executablePath}`);

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
      `⚠️ ACT: Launch with executablePath failed, trying without it. Error: ${launchErr.message}`
    );
    try {
      browser = await puppeteer.launch({
        headless: true,
        args,
      });
    } catch (fallbackErr) {
      console.error(
        `❌ ACT: Both launch attempts failed: ${fallbackErr.message}`
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
  const proxyUser = process.env.PROXY_USER_ACT;
  const proxyPass = process.env.PROXY_PASS_ACT;
  const proxyUrl = `http://${proxyHost}:${proxyPort}`;
  const targetUrl = "https://tabtrackside.com.au/results";
  const location = "ACT";

  const runScraperOnce = async () => {
    let browser, page;
    try {
      console.log("🚀 ACT: Launching browser...");
      ({ browser, page } = await launchBrowser(proxyUrl, proxyUser, proxyPass));

      // Navigation with retry for detached frame
      let navOk = false;
      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          console.log(
            `🌐 ACT: Navigating to ${targetUrl} (attempt ${attempt})...`
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
              `⚠️ ACT: Navigation failed (detached frame) attempt ${attempt}`
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
        page.waitForSelector('div[data-testid^="results-row-wrapper-"]', {
          timeout: 15000,
        })
      );

      // Extract game results
      const results = await page.evaluate(() => {
        const containers = Array.from(
          document.querySelectorAll('div[data-testid^="results-row-wrapper-"]')
        );
        const gameResults = [];

        containers.forEach((element) => {
          try {
            // Extract Game Name (e.g., "Game 765")
            const gameNameEl = element.querySelector(
              'span[data-testid^="result-game-number-"]'
            );
            const gameName = gameNameEl ? gameNameEl.textContent.trim() : "";

            // Extract Runners (Numbers)
            const runnerEls = element.querySelectorAll(
              'span[data-testid^="runner-"]'
            );
            let numbers = Array.from(runnerEls)
              .map((n) => parseInt(n.textContent.trim(), 10))
              .filter((n) => !isNaN(n));

            // Deduplicate
            numbers = Array.from(new Set(numbers));

            if (gameName && numbers.length > 0) {
              // Check if already added
              const exists = gameResults.some((g) => g.gameName === gameName);
              if (!exists) {
                // Parse game number from "Game 123"
                const gameNumberMatch = gameName.match(/Game\s+(\d+)/i);
                const gameNumber = gameNumberMatch
                  ? parseInt(gameNumberMatch[1], 10)
                  : null;

                gameResults.push({
                  gameName,
                  gameNumber,
                  numbers,
                  timestamp: new Date().toISOString(),
                });
              }
            }
          } catch (e) {}
        });

        return gameResults;
      });

      console.log(`✅ ACT: Found ${results.length} game results`);

      if (results.length === 0) {
        throw new Error(
          "No game results extracted from page (selector mismatch?)"
        );
      }

      // Save to DB
      let savedCount = 0;
      // Helper: determine transient mongo/network errors
      const isTransientMongoError = (err) => {
        if (!err) return false;
        const msg = (err.message || "").toLowerCase();
        return (
          err.name === "MongoNetworkError" ||
          err.name === "MongooseServerSelectionError" ||
          /timed out|network|econnreset|etimedout|server selection/i.test(msg)
        );
      };

      // Helper: save with retries for transient errors and handle duplicates
      const saveWithRetry = async (filter, update, options, retries = 3) => {
        let lastErr;
        for (let attempt = 1; attempt <= retries; attempt++) {
          try {
            return await TrackSideResult.findOneAndUpdate(
              filter,
              { $set: update },
              options
            );
          } catch (err) {
            lastErr = err;
            if (err && err.code === 11000) {
              // Duplicate key - another process inserted same doc concurrently
              console.warn(
                "⚠️ ACT: Duplicate key while upserting, skipping:",
                err.keyValue || err.message
              );
              return null;
            }
            if (isTransientMongoError(err) && attempt < retries) {
              console.warn(
                `⚠️ ACT: Transient DB error (attempt ${attempt}), retrying...`,
                err.message || err
              );
              await new Promise((r) => setTimeout(r, 1000 * attempt));
              continue;
            }
            throw err;
          }
        }
        throw lastErr;
      };
      // Normalize date helper (local to this file)
      const normalizeDateToISO_local = (dateStr) => {
        if (!dateStr) return null;
        if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
        const m = String(dateStr)
          .trim()
          .match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
        if (m) {
          const dd = String(m[1]).padStart(2, "0");
          const mm = String(m[2]).padStart(2, "0");
          const yyyy = m[3];
          return `${yyyy}-${mm}-${dd}`;
        }
        const d = new Date(dateStr);
        if (!isNaN(d)) {
          const yyyy = d.getFullYear();
          const mm = String(d.getMonth() + 1).padStart(2, "0");
          const dd = String(d.getDate()).padStart(2, "0");
          return `${yyyy}-${mm}-${dd}`;
        }
        return null;
      };
      for (const result of results) {
        try {
          const gameId = `${result.gameName}_${result.numbers.join("_")}`;
          const isoDate =
            normalizeDateToISO_local(new Date().toISOString().split("T")[0]) ||
            new Date().toISOString().split("T")[0];
          const filter = {
            date: isoDate,
            gameNumber: result.gameNumber,
            location,
          };
          const update = {
            gameId,
            gameName: result.gameName,
            gameNumber: result.gameNumber,
            numbers: result.numbers,
            location,
            date: isoDate,
            timestamp: new Date(),
            scraperVersion: "2.0",
          };

          // Use atomic $set to avoid replacement semantics and ensure defaults
          const options = {
            upsert: true,
            new: true,
            setDefaultsOnInsert: true,
          };
          const savedDoc = await saveWithRetry(filter, update, options, 3);

          if (savedDoc) {
            console.log(
              `✅ ACT: Saved ${
                result.gameName
              } - Numbers: ${result.numbers.join(",")}`
            );
            savedCount++;
          }
        } catch (dbErr) {
          console.error(`❌ ACT: DB Error saving ${result.gameName}:`, dbErr);
        }
      }

      console.log(
        `✅ ACT: ${savedCount}/${results.length} results saved to DB`
      );
      await safeClose(browser);
      return results;
    } catch (err) {
      console.error("❌ ACT runScraperOnce failed:", err.message);
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

// Get latest results from database (Legacy)
export const getLatestTrackSideResults = async (
  location = "ACT",
  limit = 10
) => {
  try {
    const results = await TrackSideResult.find({ location })
      .sort({ timestamp: -1 })
      .limit(limit)
      .lean();
    return results;
  } catch (err) {
    console.error("❌ ACT: Error fetching TrackSide results:", err.message);
    return [];
  }
};

// Get filtered results with pagination
export const getFilteredTrackSideResults = async (query = {}) => {
  try {
    const {
      location = "ACT",
      limit = 10,
      page = 1,
      startDate,
      endDate,
      startGameNo,
      endGameNo,
    } = query;

    const filter = { location };

    // Date Filtering
    if (startDate || endDate) {
      filter.date = {};
      if (startDate) filter.date.$gte = startDate;
      if (endDate) filter.date.$lte = endDate;
    }

    // Game Number Filtering
    if (startGameNo || endGameNo) {
      filter.gameNumber = {};
      if (startGameNo) filter.gameNumber.$gte = parseInt(startGameNo);
      if (endGameNo) filter.gameNumber.$lte = parseInt(endGameNo);
    }

    const limitNum = parseInt(limit);
    const pageNum = parseInt(page);
    const skip = (pageNum - 1) * limitNum;

    const totalCount = await TrackSideResult.countDocuments(filter);
    const results = await TrackSideResult.find(filter)
      .sort({ timestamp: -1 }) // Sort by latest first
      .skip(skip)
      .limit(limitNum)
      .lean();

    return {
      data: results,
      totalCount,
      totalPages: Math.ceil(totalCount / limitNum),
      currentPage: pageNum,
    };
  } catch (err) {
    console.error(
      "❌ ACT: Error fetching filtered TrackSide results:",
      err.message
    );
    return { data: [], totalCount: 0, totalPages: 0, currentPage: 1 };
  }
};

// ✅ PAGINATION ONLY (No Filters)
export const getPaginatedTrackSideResultsOnly = async (query = {}) => {
  try {
    const { location = "ACT", limit = 10, page = 1 } = query;

    const filter = { location };
    // Explicitly ignoring other filters

    const limitNum = parseInt(limit);
    const pageNum = parseInt(page);
    const skip = (pageNum - 1) * limitNum;

    const totalCount = await TrackSideResult.countDocuments(filter);
    const results = await TrackSideResult.find(filter)
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(limitNum)
      .lean();

    return {
      data: results,
      totalCount,
      totalPages: Math.ceil(totalCount / limitNum),
      currentPage: pageNum,
    };
  } catch (err) {
    console.error("❌ ACT: Error fetching paginated results:", err.message);
    return { data: [], totalCount: 0, totalPages: 0, currentPage: 1 };
  }
};

// ✅ FILTERING ONLY (No Pagination - returns all matches)
export const getFilteredTrackSideResultsOnly = async (query = {}) => {
  try {
    const {
      location = "ACT",
      startDate,
      endDate,
      startGameNo,
      endGameNo,
    } = query;

    const filter = { location };

    // Date Filtering
    if (startDate || endDate) {
      filter.date = {};
      if (startDate) filter.date.$gte = startDate;
      if (endDate) filter.date.$lte = endDate;
    }

    // Game Number Filtering
    if (startGameNo || endGameNo) {
      filter.gameNumber = {};
      if (startGameNo) filter.gameNumber.$gte = parseInt(startGameNo);
      if (endGameNo) filter.gameNumber.$lte = parseInt(endGameNo);
    }

    // No skip/limit here, just find all matching
    const results = await TrackSideResult.find(filter)
      .sort({ timestamp: -1 })
      .lean();

    return {
      data: results,
      totalCount: results.length,
      // No pages logic needed really, but keeping structure consistent if desired, or just omit
      totalPages: 1,
      currentPage: 1,
    };
  } catch (err) {
    console.error("❌ ACT: Error fetching filtered results:", err.message);
    return { data: [], totalCount: 0, totalPages: 0, currentPage: 1 };
  }
};
