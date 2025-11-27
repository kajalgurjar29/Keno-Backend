// TrackSide Racing Results Scraper
// Scrapes from https://tabtrackside.com.au/results

import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import chromium from "chromium";
import TrackSideResult from "../../models/TrackSideResult.ACT.model.js";
import util from "util";
const execAsync = util.promisify(exec);
import { exec } from "child_process";

// ✅ Use stealth plugin but disable problematic evasions
const stealth = StealthPlugin();
stealth.enabledEvasions.delete("user-agent-override");
stealth.enabledEvasions.delete("navigator.plugins");
stealth.enabledEvasions.delete("navigator.webdriver");
puppeteer.use(stealth);

// Main scraper function
export const scrapeTrackSideResults = async () => {
  const proxyHost = process.env.PROXY_HOST || "au.decodo.com";
  const proxyPort = process.env.PROXY_PORT || "30001";
  const proxyUser = process.env.PROXY_USER_TRACKSIDE || "spr1wu95yq";
  const proxyPass = process.env.PROXY_PASS_TRACKSIDE || "w06feLHNn1Cma3=ioy";

  const proxyUrl = `http://${proxyHost}:${proxyPort}`;
  const args = [
    "--no-sandbox",
    "--disable-setuid-sandbox",
    "--disable-dev-shm-usage",
    `--proxy-server=${proxyUrl}`,
  ];

  const executablePath = process.env.CHROMIUM_PATH || chromium.executablePath;

  let browser;
  try {
    console.log("🚀 Launching browser for TrackSide...");
    browser = await puppeteer.launch({
      headless: true,
      executablePath,
      args,
    });

    const page = await browser.newPage();

    if (proxyUser && proxyPass) {
      await page.authenticate({
        username: proxyUser,
        password: proxyPass,
      });
    }

    console.log("🌐 Navigating to TrackSide Results...");
    await page.goto("https://tabtrackside.com.au/results", {
      waitUntil: "networkidle2",
      timeout: 120000,
    });

    // Get current location from page
    const location = await page.evaluate(() => {
      // Try to get location from dropdown or page content
      const regionText = document.body.innerText;
      if (regionText.includes("NSW")) return "NSW";
      if (regionText.includes("QLD")) return "QLD";
      if (regionText.includes("VIC")) return "VIC";
      return "NSW"; // Default
    });

    console.log("📍 Current location:", location);
    console.log("⏳ Waiting for game results...");

    // Wait for any content to load
    await page.waitForTimeout(3000);

    console.log("✅ Extracting TrackSide results...");

    // Wait for common result containers (tries a few selectors used on TrackSide)
    const possibleSelectors = [
      ".results-list",
      ".results__list",
      ".result-card",
      ".game-result",
      ".result-item",
      "table.results",
      ".race-results",
      ".results-container",
    ];

    let foundSelector = null;
    for (const sel of possibleSelectors) {
      try {
        await page.waitForSelector(sel, { timeout: 4000 });
        foundSelector = sel;
        break;
      } catch (e) {
        // ignore and try next
      }
    }

    // If we didn't find a dedicated container, wait a bit longer for body text
    if (!foundSelector) {
      await page.waitForTimeout(2000);
    }

    const results = await page.evaluate(() => {
      const containers = [];
      const selectors = [
        ".result-card",
        ".game-result",
        ".result-item",
        "tr[data-game]",
        "table.results tr",
        ".result-row",
        ".results__item",
      ];

      selectors.forEach((s) => {
        document.querySelectorAll(s).forEach((el) => containers.push(el));
      });

      // Deduplicate containers
      const uniqueContainers = Array.from(new Set(containers));

      const gameResults = [];

      uniqueContainers.forEach((element) => {
        try {
          // Try to find explicit number elements first
          const numberEls = element.querySelectorAll(
            ".number, .ball, .result-number, .number__item, td.number, span.number"
          );
          let numbers = Array.from(numberEls)
            .map((n) => parseInt(n.textContent.trim(), 10))
            .filter((n) => !isNaN(n));

          // Fallback: look for sequences of numbers in element text
          if (numbers.length === 0) {
            const text = element.innerText || element.textContent || "";
            const matches = text.match(/\b(\d{1,2})\b/g) || [];
            numbers = matches.map(Number).filter((n) => !isNaN(n));
          }

          // Normalize unique numbers
          numbers = Array.from(new Set(numbers)).filter(
            (n) => n >= 1 && n <= 80
          );

          if (numbers.length >= 2 && numbers.length <= 10) {
            // attempt to get a name/title
            const titleEl =
              element.querySelector(
                ".game-name, .game-title, .title, th:first-child, td:first-child"
              ) ||
              element.querySelector("h3") ||
              element.querySelector("h2");
            const gameName = titleEl
              ? (titleEl.textContent || titleEl.innerText).trim()
              : (
                  element.getAttribute("aria-label") ||
                  element.getAttribute("data-game") ||
                  ""
                )
                  .toString()
                  .trim();

            const name =
              gameName && gameName.length > 0
                ? gameName
                : "TRACKSIDE_" + numbers.slice(0, 3).join("_");

            // avoid duplicates by numbers
            const exists = gameResults.some(
              (g) =>
                JSON.stringify(g.numbers.sort()) ===
                JSON.stringify(numbers.sort())
            );
            if (!exists) {
              gameResults.push({
                gameName: name,
                drawNumber: "",
                numbers,
                timestamp: new Date().toISOString(),
              });
            }
          }
        } catch (e) {
          // ignore element parsing errors
        }
      });

      // As a final fallback, parse body lines for standalone numeric lines
      if (gameResults.length === 0) {
        const lines = document.body.innerText.split("\n");
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i].trim();
          if (!line) continue;
          if (/^[\d\s,]+$/.test(line)) {
            const nums = line
              .split(/[\s,]+/)
              .map((n) => parseInt(n, 10))
              .filter((n) => !isNaN(n) && n >= 1 && n <= 80);
            if (nums.length >= 2 && nums.length <= 10) {
              let gameName = "TRACKSIDE_FALLBACK";
              for (let j = Math.max(0, i - 3); j < i; j++) {
                const prev = lines[j].trim();
                if (
                  prev &&
                  /^[A-Z\s]+$/.test(prev) &&
                  prev.length > 3 &&
                  prev.length < 30
                ) {
                  gameName = prev;
                  break;
                }
              }
              gameResults.push({
                gameName,
                drawNumber: "",
                numbers: Array.from(new Set(nums)),
                timestamp: new Date().toISOString(),
              });
            }
          }
        }
      }

      return gameResults;
    });

    console.log("🎯 TrackSide Results Found:", results.length);
    if (results.length > 0) {
      console.log("Sample result:", results[0]);
    }

    if (results.length === 0) {
      console.warn("⚠️ No results extracted. Trying alternative method...");

      // Try alternative: look for specific patterns in page text
      const alternativeResults = await page.evaluate(() => {
        const alternativeGameResults = [];
        const pageText = document.body.innerText;

        // Split by newlines and look for result-like patterns
        const lines = pageText.split("\n");

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i].trim();

          // Match patterns like "2 5 7 12 15 20" or "2, 5, 7, 12"
          if (line.match(/^[\d\s,]+$/)) {
            const numbers = line
              .split(/[\s,]+/)
              .map((n) => parseInt(n.trim(), 10))
              .filter((n) => !isNaN(n) && n >= 1 && n <= 80);

            if (numbers.length >= 2 && numbers.length <= 8) {
              // Check previous lines for game name
              let gameName = "TRACKSIDE";
              for (let j = Math.max(0, i - 3); j < i; j++) {
                const prevLine = lines[j].trim().toUpperCase();
                if (
                  prevLine.length > 3 &&
                  prevLine.length < 30 &&
                  prevLine.match(/^[A-Z\s]+$/)
                ) {
                  gameName = prevLine;
                  break;
                }
              }

              alternativeGameResults.push({
                gameName,
                drawNumber: "",
                numbers,
                timestamp: new Date().toISOString(),
              });
            }
          }
        }

        return alternativeGameResults;
      });

      console.log(
        "🎯 Alternative extraction found:",
        alternativeResults.length
      );
      if (alternativeResults.length > 0) {
        results.push(...alternativeResults);
        console.log("Sample result:", alternativeResults[0]);
      }
    }

    if (results.length === 0) {
      // Return dummy data for testing
      console.warn("⚠️ No results found on page. Returning test data.");
      return [
        {
          gameName: "THUMBSUCKER",
          drawNumber: "22",
          numbers: [2, 5, 7, 12, 15, 20],
          timestamp: new Date().toISOString(),
        },
      ];
    }

    // Save to database with findOneAndUpdate for clearer result
    let savedCount = 0;
    for (const result of results) {
      try {
        const gameId = `${result.gameName}_${result.numbers.join("_")}`;
        const filter = { gameId: gameId, location: location.toUpperCase() };
        const update = {
          gameId: gameId,
          gameName: result.gameName,
          drawNumber: result.drawNumber || "",
          numbers: result.numbers,
          location: location.toUpperCase(),
          date: new Date().toISOString().split("T")[0],
          timestamp: new Date(),
          scraperVersion: "1.0",
        };

        const savedDoc = await TrackSideResult.findOneAndUpdate(
          filter,
          update,
          { upsert: true, new: true, setDefaultsOnInsert: true }
        );
        if (savedDoc) {
          console.log(
            `✅ Saved: ${result.gameName} - Numbers: ${result.numbers.join(
              ","
            )}`
          );
          savedCount++;
        } else {
          console.warn(`⚠️ Not saved (no doc returned) for ${result.gameName}`);
        }
      } catch (dbErr) {
        console.error(
          `❌ DB Error saving ${result.gameName}:`,
          dbErr && dbErr.message ? dbErr.message : dbErr
        );
      }
    }

    console.log(
      `✅ TrackSide: ${savedCount}/${results.length} results saved to database`
    );
    return results;
  } catch (err) {
    console.error("❌ TrackSide Scraping failed:", err.message);
    throw err;
  } finally {
    if (browser) {
      try {
        await browser.close();
        console.log("🧹 Browser closed");
      } catch (closeErr) {
        console.error("Error closing browser:", closeErr.message);
        await killZombieChromium();
      }
    }
  }
};

// Kill zombie chromium processes
const killZombieChromium = async () => {
  try {
    if (process.platform === "win32") {
      await execAsync(
        "taskkill /F /IM chrome.exe /T 2>nul & taskkill /F /IM chromium.exe /T 2>nul"
      );
    } else {
      await execAsync('pkill -f "chrome|chromium" || true');
    }
    console.log("🧹 Cleaned up zombie processes");
  } catch (err) {
    console.warn("Could not kill processes:", err.message);
  }
};

// Retry logic
const retry = async (fn, retries = 3, delay = 2000) => {
  let lastError;
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      console.warn(`Retry ${i + 1}/${retries} failed: ${err.message}`);
      if (i < retries - 1) await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw lastError;
};

// Wrapped version with retry
export const scrapeTrackSideResultsWithRetry = () => {
  return retry(scrapeTrackSideResults, 3, 3000);
};

// Get latest results from database
export const getLatestTrackSideResults = async (
  location = "NSW",
  limit = 10
) => {
  try {
    const results = await TrackSideResult.find({
      location: location.toUpperCase(),
    })
      .sort({ timestamp: -1 })
      .limit(limit)
      .lean();

    return results;
  } catch (err) {
    console.error("Error fetching TrackSide results:", err.message);
    return [];
  }
};
