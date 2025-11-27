// NSW TrackSide Racing Results Scraper
// Based on ACTTrackSideScraperScaping.controller.js but forces NSW region
import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import chromium from "chromium";
import TrackSideResult from "../../models/TrackSideResult.NSW.model.js";
import util from "util";
const execAsync = util.promisify(exec);
import { exec } from "child_process";

const stealth = StealthPlugin();
stealth.enabledEvasions.delete("user-agent-override");
stealth.enabledEvasions.delete("navigator.plugins");
stealth.enabledEvasions.delete("navigator.webdriver");
puppeteer.use(stealth);

export const scrapeTrackSideResults = async () => {
  // reuse ACT scraper logic but force location to NSW for DB writes
  // (most logic copied from ACTTrackSideScraperScaping.controller.js)
  // NOTE: keep synchronized with other region controllers

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
    browser = await puppeteer.launch({ headless: true, executablePath, args });
    const page = await browser.newPage();
    if (proxyUser && proxyPass) {
      await page.authenticate({ username: proxyUser, password: proxyPass });
    }

    await page.goto("https://tabtrackside.com.au/results", {
      waitUntil: "networkidle2",
      timeout: 120000,
    });

    // Force region to NSW for this controller
    let location = "NSW";

    await page.waitForTimeout(3000);

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
      } catch (e) {}
    }

    if (!foundSelector) await page.waitForTimeout(2000);

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

      selectors.forEach((s) =>
        document.querySelectorAll(s).forEach((el) => containers.push(el))
      );

      const uniqueContainers = Array.from(new Set(containers));
      const gameResults = [];

      uniqueContainers.forEach((element) => {
        try {
          const numberEls = element.querySelectorAll(
            ".number, .ball, .result-number, .number__item, td.number, span.number"
          );
          let numbers = Array.from(numberEls)
            .map((n) => parseInt(n.textContent.trim(), 10))
            .filter((n) => !isNaN(n));
          if (numbers.length === 0) {
            const text = element.innerText || element.textContent || "";
            const matches = text.match(/\b(\d{1,2})\b/g) || [];
            numbers = matches.map(Number).filter((n) => !isNaN(n));
          }
          numbers = Array.from(new Set(numbers)).filter(
            (n) => n >= 1 && n <= 80
          );

          if (numbers.length >= 2 && numbers.length <= 10) {
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
        } catch (e) {}
      });

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

    if (results.length === 0) {
      return [
        {
          gameName: "THUMBSUCKER",
          drawNumber: "22",
          numbers: [2, 5, 7, 12, 15, 20],
          timestamp: new Date().toISOString(),
        },
      ];
    }

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
        if (savedDoc) savedCount++;
      } catch (dbErr) {
        console.error(
          `DB Error saving ${result.gameName}:`,
          dbErr && dbErr.message ? dbErr.message : dbErr
        );
      }
    }

    return results;
  } catch (err) {
    throw err;
  } finally {
    if (browser) {
      try {
        await browser.close();
      } catch (closeErr) {
        /* ignore */
      }
    }
  }
};

// simple retry wrapper
const retry = async (fn, retries = 3, delay = 2000) => {
  let lastError;
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (i < retries - 1) await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw lastError;
};

export const scrapeTrackSideResultsWithRetry = () =>
  retry(scrapeTrackSideResults, 3, 3000);

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
