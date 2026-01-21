// import puppeteer from "puppeteer-core";
import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import chromium from "chromium";
import fs from "fs";
import { execSync } from "child_process";
import { getChromiumPath } from "../../utils/chromiumPath.js";
import KenoResult from "../../models/NSWkenoDrawResult.model.js";
import util from "util";
import { getIO } from "../../utils/socketUtils.js";
const execAsync = util.promisify(exec);
import { exec } from "child_process";

// Use shared helper from src/utils/chromiumPath.js

// ✅ Use stealth plugin but disable problematic evasions
const stealth = StealthPlugin();
stealth.enabledEvasions.delete("user-agent-override");
stealth.enabledEvasions.delete("navigator.plugins");
stealth.enabledEvasions.delete("navigator.webdriver");
puppeteer.use(stealth);

// Scraper function
export const scrapeNSWKeno = async () => {
  // Load proxy details from env (set in your .env file)
  const proxyHost = process.env.PROXY_HOST || "gw.dataimpulse.com";
  const proxyPort = process.env.PROXY_PORT || "823";
  const proxyUser = process.env.PROXY_USER_NSW || "a9357935f3ded2c2b707";
  const proxyPass = process.env.PROXY_PASS_NSW || "c39b6f9adacd4155";

  const proxyUrl = `http://${proxyHost}:${proxyPort}`;

  const args = [
    "--no-sandbox",
    "--disable-setuid-sandbox",
    "--disable-dev-shm-usage",
    `--proxy-server=${proxyUrl}`,
  ];

  // Use module-level `getChromiumPath` helper to discover Chromium/Chrome
  const executablePath = getChromiumPath() || null;

  const browser = await puppeteer.launch({
    headless: true,
    executablePath,
    args,
  });

  const page = await browser.newPage();

  // Handle proxy authentication (Decodo requires this separately)
  if (proxyUser && proxyPass) {
    await page.authenticate({
      username: proxyUser,
      password: proxyPass,
    });
  }

  try {
    // Navigate to Keno results page
    await page.goto("https://www.keno.com.au/check-results", {
      waitUntil: "networkidle2",
      timeout: 120000, // increased timeout for server/proxy lag
    });

    // Wait for numbers to appear
    await page.waitForSelector(".game-ball-wrapper.is-drawn.is-placed", {
      timeout: 60000,
    });

    // Extract game data
    const data = await page.evaluate(() => {
      const balls = Array.from(
        document.querySelectorAll(".game-ball-wrapper.is-drawn.is-placed")
      )
        .map((el) => parseInt(el.textContent.trim(), 10))
        .filter((n) => !isNaN(n));

      const drawText =
        document.querySelector(".game-board-status-heading")?.textContent ||
        document.querySelector(".game-number")?.textContent ||
        "";

      const dateText =
        document.querySelector('input[data-id="check-results-date-input"]')
          ?.value || "";

      return {
        draw: drawText.replace(/[^\d]/g, ""),
        date: dateText.trim(),
        numbers: balls,
      };
    });

    await browser.close();
    return data;
  } catch (err) {
    console.error("Scraping failed:", err.message);
    await browser.close();
    throw err;
  }
};

// Filter to keep only increasing sequence
const filterIncreasingNumbers = (numbers) => {
  const result = [];
  for (let i = 0; i < numbers.length; i++) {
    if (i === 0 || numbers[i] >= numbers[i - 1]) {
      result.push(numbers[i]);
    } else break;
  }
  return result;
};

// Retry wrapper
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

// Kill any existing Chromium/Chrome processes
const killZombieChromium = async () => {
  try {
    await execAsync("pkill -f chromium || pkill -f chrome");
  } catch {
    try {
      await execAsync(
        "taskkill /F /IM chrome.exe /T || taskkill /F /IM chromium.exe /T"
      );
    } catch (_) { }
  }
};

// Safe close browser
const safeClose = async (browser) => {
  if (!browser) return;
  try {
    await browser.close();
  } catch {
    await killZombieChromium();
  }
};

// Main scraper function with retries and DB save
export const scrapeNSWKenobyGame = async () => {
  const proxyHost = process.env.PROXY_HOST || "gw.dataimpulse.com";
  const proxyPort = process.env.PROXY_PORT || "823";
  const proxyUser = process.env.PROXY_USER_NSW || "a9357935f3ded2c2b707";
  const proxyPass = process.env.PROXY_PASS_NSW || "c39b6f9adacd4155";
  const executablePath = getChromiumPath() || null;

  const proxyUrl = `http://${proxyHost}:${proxyPort}`;

  const targetUrl = "https://www.keno.com.au/check-results";

  const launchBrowser = async (useProxy = true) => {
    const args = [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
    ];
    if (useProxy) args.push(`--proxy-server=${proxyUrl}`);

    const browser = await puppeteer.launch({
      headless: true,
      executablePath,
      args,
    });

    const page = await browser.newPage();

    if (useProxy && proxyUser && proxyPass) {
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

  const runScraperOnce = async () => {
    let browser, page;
    try {
      ({ browser, page } = await launchBrowser(true));

      // Navigation with retry for detached frame
      let navOk = false;
      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
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
              `⚠️ Navigation failed (detached frame) attempt ${attempt}`
            );
            await safeClose(browser);
            ({ browser, page } = await launchBrowser(true));
            continue;
          }
          throw err;
        }
      }
      if (!navOk) throw new Error("Navigation failed after retries");

      // Akamai block check
      const bodyText = await page.evaluate(() => document.body.innerText);
      if (/Access Denied|blocked|verify/i.test(bodyText))
        throw new Error("Blocked by Akamai (Access Denied)");

      // Wait for numbers
      await retry(() =>
        page.waitForSelector(
          ".game-ball-wrapper, .keno-ball, .draw-result, .game-board",
          { timeout: 15000 }
        )
      );

      // Extract data
      const data = await page.evaluate(() => {
        const allBalls = Array.from(
          document.querySelectorAll(".game-ball-wrapper, .keno-ball")
        );
        const balls = allBalls
          .map((el) => parseInt(el.textContent.trim(), 10))
          .filter((n) => !isNaN(n));

        const drawText =
          document.querySelector(".game-board-status-heading")?.textContent ||
          document.querySelector(".game-number")?.textContent ||
          "";

        const dateText =
          document.querySelector('input[data-id="check-results-date-input"]')
            ?.value || "";

        return {
          draw: drawText.replace(/[^\d]/g, ""),
          date: dateText.trim(),
          numbers: balls,
        };
      });

      data.numbers = filterIncreasingNumbers(data.numbers);

      // Create drawid for uniqueness checking (draw + date combination)
      data.drawid = `${data.draw}_${data.date}`;

      // Save to DB with idempotent upsert to avoid E11000 duplicate errors
      await retry(
        async () => {
          if (!data || !data.draw || String(data.draw).trim() === "") {
            console.warn("⚠️ NSW: Invalid draw value, skipping DB save:", data);
            return;
          }

          const upsertRes = await KenoResult.updateOne(
            { drawid: data.drawid },
            { $setOnInsert: data },
            { upsert: true }
          );

          // Log full result for easier debugging across mongoose versions
          console.log("NSW upsert result:", upsertRes);

          const inserted =
            (upsertRes.upsertedCount && upsertRes.upsertedCount > 0) ||
            Boolean(upsertRes.upsertedId) ||
            Boolean(upsertRes.upserted);

          if (inserted) {
            console.log("✅ NSW data inserted:", data.draw, "on", data.date);
          } else {
            console.log(
              "ℹ️  NSW draw already exists for this date or not inserted:",
              data.draw,
              "on",
              data.date
            );
          }
        },
        3,
        2000
      );

      // Socket Emission for new results
      try {
        const io = getIO();
        io.emit("newResult", {
          type: "KENO",
          location: "NSW",
          draw: data.draw,
          numbers: data.numbers
        });
        console.log("📡 NSW Keno: Emitted 'newResult' socket event");
      } catch (socketErr) {
        console.warn("⚠️ NSW Keno: Socket emit failed:", socketErr.message);
      }

      await safeClose(browser);
      return data;
    } catch (err) {
      console.error("❌ runScraperOnce failed:", err.message);
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

// Fetch recent Keno results
export const getKenoResults = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const results = await KenoResult.find({})
      .sort({ createdAt: -1 })
      .limit(limit);

    res.status(200).json({ success: true, results });
  } catch (err) {
    console.error("Failed to fetch Keno results:", err.message);
    res.status(500).json({ success: false, message: err.message });
  }
};

// Fetch filtered Keno results and pagination
export const getFilteredKenoResults = async (req, res) => {
  try {
    const {
      firstGameNumber,
      lastGameNumber,
      date, // single day YYYY-MM-DD
      startDate, // range start YYYY-MM-DD
      endDate, // range end YYYY-MM-DD
      combination,
      limit = 50, // default limit
      page = 1, // default page
    } = req.query;

    const filter = {};

    // Filter by draw number
    if (firstGameNumber && lastGameNumber) {
      filter.draw = {
        $gte: String(firstGameNumber),
        $lte: String(lastGameNumber),
      };
    } else if (firstGameNumber) {
      filter.draw = { $gte: String(firstGameNumber) };
    } else if (lastGameNumber) {
      filter.draw = { $lte: String(lastGameNumber) };
    }

    // Filter by timestamp using createdAt
    if (date) {
      const start = new Date(date + "T00:00:00.000Z");
      const end = new Date(date + "T23:59:59.999Z");
      filter.createdAt = { $gte: start, $lte: end };
    } else if (startDate && endDate) {
      const start = new Date(startDate + "T00:00:00.000Z");
      const end = new Date(endDate + "T23:59:59.999Z");
      filter.createdAt = { $gte: start, $lte: end };
    }

    // Filter by drawn combination
    if (combination) {
      const numbers = combination
        .split(",")
        .map((num) => Number(num.trim()))
        .filter((num) => !isNaN(num));
      if (numbers.length > 0) filter.numbers = { $all: numbers };
    }

    // Convert page and limit to numbers
    const limitNum = Number(limit);
    const pageNum = Number(page);
    const skip = (pageNum - 1) * limitNum;

    // Debug: see filter object
    console.log("🔹 Filter object:", filter, "Skip:", skip, "Limit:", limitNum);

    // Get total count for pagination info
    const totalResults = await KenoResult.countDocuments(filter);

    const results = await KenoResult.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum);

    res.status(200).json({
      success: true,
      total: totalResults,
      page: pageNum,
      limit: limitNum,
      results,
    });
  } catch (err) {
    console.error("❌ Failed to fetch filtered Keno results:", err.message);
    res.status(500).json({ success: false, message: err.message });
  }
};
