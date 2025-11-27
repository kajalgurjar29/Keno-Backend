// import puppeteer from "puppeteer-core";
import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import chromium from "chromium";
import KenoResult from "../../models/ACTkenoDrawResult.model.js";
import util from "util";
const execAsync = util.promisify(exec);
import { exec } from "child_process";

// ✅ Use stealth plugin but disable problematic evasions
const stealth = StealthPlugin();
stealth.enabledEvasions.delete("user-agent-override");
stealth.enabledEvasions.delete("navigator.plugins");
stealth.enabledEvasions.delete("navigator.webdriver");
puppeteer.use(stealth);

// Scrape ATC Keno results
export const scrapeATCKeno = async () => {
  // ✅ Proxy details
  const proxyHost = process.env.PROXY_HOST || "au.decodo.com";
  const proxyPort = process.env.PROXY_PORT || "30001";
  const proxyUser = process.env.PROXY_USER_ACT || "spr1wu95yq";
  const proxyPass = process.env.PROXY_PASS_ACT || "w06feLHNn1Cma3=ioy";

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

    console.log("🌐 Navigating to Keno Results page...");
    await page.goto("https://www.keno.com.au/check-results", {
      waitUntil: "networkidle2",
      timeout: 120000,
    });

    // ✅ Try to switch region to VIC
    try {
      console.log("🔁 Switching to VIC region...");
      await page.waitForSelector('[data-id="check-results-region-selector"]', {
        timeout: 15000,
      });
      await page.click('[data-id="check-results-region-selector"]');

      await page.waitForTimeout(1000); // give dropdown time to open

      await page.evaluate(() => {
        const options = Array.from(
          document.querySelectorAll('li[role="option"]')
        );
        const vic = options.find((el) => el.textContent.includes("VIC"));
        if (vic) vic.click();
      });

      // ⚠️ ❌ REMOVE waitForNavigation() to avoid frame detach
      // ✅ Instead, wait for the results container to update
      await page.waitForSelector(".game-ball-wrapper", { timeout: 30000 });
      await page.waitForTimeout(2000); // small delay to ensure data loads
    } catch (e) {
      console.warn("⚠️ Could not switch to VIC automatically:", e.message);
    }

    // ✅ Debug current region
    const currentRegion = await page.evaluate(() => {
      return (
        document
          .querySelector('[data-id="check-results-region-selector"]')
          ?.textContent?.trim() || "Unknown"
      );
    });
    console.log("📍 Current region:", currentRegion);

    console.log("⏳ Waiting for game numbers...");
    await page.waitForSelector(".game-ball-wrapper:not(.is-blank)", {
      timeout: 60000,
    });

    console.log("✅ Extracting results...");
    const result = await page.evaluate(() => {
      const balls = Array.from(
        document.querySelectorAll(".game-ball-wrapper:not(.is-blank)")
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

    console.log("🎯 Final VIC Keno Result:", result);
    return result;
  } catch (err) {
    console.error("❌ Scraping failed:", err.message);
    console.error(err.stack);
    throw err;
  } finally {
    if (browser) {
      await browser.close();
      console.log("🧹 Browser closed.");
    }
  }
};

const filterIncreasingNumbers = (numbers) => {
  const result = [];
  for (let i = 0; i < numbers.length; i++) {
    if (i === 0 || numbers[i] >= numbers[i - 1]) {
      result.push(numbers[i]);
    } else break;
  }
  return result;
};

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

const killZombieChromium = async () => {
  try {
    await execAsync("pkill -f chromium || pkill -f chrome");
  } catch {
    try {
      await execAsync(
        "taskkill /F /IM chrome.exe /T || taskkill /F /IM chromium.exe /T"
      );
    } catch (_) {}
  }
};

const safeClose = async (browser) => {
  if (!browser) return;
  try {
    await browser.close();
  } catch {
    await killZombieChromium();
  }
};

export const scrapeACTKenoByGame = async () => {
  const proxyHost = process.env.PROXY_HOST || "au.decodo.com";
  const proxyPort = process.env.PROXY_PORT || "30001";
  const proxyUser = process.env.PROXY_USER_ACT || "your_act_proxy_user";
  const proxyPass = process.env.PROXY_PASS_ACT || "your_act_proxy_pass";
  const executablePath = process.env.CHROMIUM_PATH || chromium.path;

  const proxyUrl = `http://${proxyHost}:${proxyPort}`;
  const targetUrl = "https://www.keno.com.au/check-results";

  const launchBrowser = async (retryLaunch = false) => {
    const args = [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-blink-features=AutomationControlled",
      `--proxy-server=${proxyUrl}`,
    ];

    let browser;
    try {
      browser = await puppeteer.launch({
        headless: true,
        executablePath,
        args,
        ignoreHTTPSErrors: true,
      });

      const page = await browser.newPage();

      // Check if browser is connected before proceeding
      if (!browser.isConnected()) {
        throw new Error("Browser disconnected immediately after launch");
      }

      try {
        await page.authenticate({ username: proxyUser, password: proxyPass });
      } catch (authErr) {
        console.warn("⚠️ Authentication error (non-fatal):", authErr.message);
      }

      // Set user agent with error handling
      try {
        await page.setUserAgent(
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) " +
            "AppleWebKit/537.36 (KHTML, like Gecko) " +
            "Chrome/124.0.0.0 Safari/537.36"
        );
        await page.setExtraHTTPHeaders({ "Accept-Language": "en-US,en;q=0.9" });
      } catch (uaErr) {
        // If setting user agent fails due to target closed, close and retry
        if (
          uaErr.message.includes("Target closed") ||
          uaErr.message.includes("Protocol error")
        ) {
          console.warn("⚠️ Target closed during user agent setup, retrying...");
          await safeClose(browser);
          if (!retryLaunch) {
            // Wait a bit before retrying
            await new Promise((resolve) => setTimeout(resolve, 2000));
            return await launchBrowser(true);
          }
          throw uaErr;
        }
        throw uaErr;
      }

      return { browser, page };
    } catch (err) {
      // Clean up if browser was created but something failed
      if (browser) {
        await safeClose(browser);
      }
      throw err;
    }
  };

  const runScraperOnce = async () => {
    let browser, page;
    try {
      ({ browser, page } = await launchBrowser());

      // Navigation with retry for detached frame
      let navOk = false;
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          // Check if browser is still connected
          if (!browser.isConnected()) {
            throw new Error("Browser disconnected");
          }

          const response = await page.goto(targetUrl, {
            waitUntil: "domcontentloaded",
            timeout: 30000,
          });

          if (!response || !response.ok()) {
            throw new Error(`Bad response: ${response?.status()}`);
          }

          navOk = true;
          break;
        } catch (err) {
          if (/detached|Target closed|Protocol error/i.test(err.message)) {
            console.warn(
              `⚠️ Navigation failed (detached/closed) attempt ${attempt}/3:`,
              err.message
            );
            await safeClose(browser);
            // Wait before retrying
            await new Promise((resolve) => setTimeout(resolve, 2000));
            ({ browser, page } = await launchBrowser());
            continue;
          }
          throw err;
        }
      }

      if (!navOk) {
        throw new Error("Navigation failed after 3 retries");
      }

      // Check for Akamai block
      try {
        const bodyText = await page.evaluate(() => document.body.innerText);
        if (/Access Denied|blocked|verify/i.test(bodyText)) {
          throw new Error("Blocked by Akamai (Access Denied)");
        }
      } catch (evalErr) {
        if (
          /Target closed|Protocol error|Execution context was destroyed/i.test(
            evalErr.message
          )
        ) {
          throw new Error("Page closed during evaluation");
        }
        throw evalErr;
      }

      // Switch region to ACT
      try {
        // Check if page is still connected
        if (!browser.isConnected() || page.isClosed()) {
          throw new Error("Page closed before region switch");
        }

        await page.waitForSelector(
          '[data-id="check-results-region-selector"]',
          {
            timeout: 15000,
          }
        );
        await page.click('[data-id="check-results-region-selector"]');
        await page.waitForTimeout(1000);

        await page.evaluate(() => {
          const options = Array.from(
            document.querySelectorAll('li[role="option"]')
          );
          const act = options.find((el) => el.textContent.includes("ACT"));
          if (act) act.click();
        });
        await page.waitForSelector(".game-ball-wrapper", { timeout: 30000 });
        await page.waitForTimeout(2000);
      } catch (e) {
        if (
          /Target closed|Protocol error|Execution context was destroyed/i.test(
            e.message
          )
        ) {
          throw new Error("Page closed during region switch");
        }
        console.warn("⚠️ Could not switch to ACT region:", e.message);
      }

      // Wait for results
      await retry(async () => {
        if (!browser.isConnected() || page.isClosed()) {
          throw new Error("Page closed while waiting for results");
        }
        return await page.waitForSelector(".game-ball-wrapper, .keno-ball", {
          timeout: 15000,
        });
      });

      // Extract draw data
      const data = await page
        .evaluate(() => {
          // Check if we're still in a valid context
          if (!document || !document.body) {
            throw new Error("Document context invalid");
          }
          const balls = Array.from(
            document.querySelectorAll(".game-ball-wrapper, .keno-ball")
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
        })
        .catch((evalErr) => {
          if (
            /Target closed|Protocol error|Execution context was destroyed/i.test(
              evalErr.message
            )
          ) {
            throw new Error("Page closed during data extraction");
          }
          throw evalErr;
        });

      data.numbers = filterIncreasingNumbers(data.numbers);

      // Save to DB with idempotent upsert (avoid E11000 duplicate key errors)
      await retry(async () => {
        const upsertRes = await KenoResult.updateOne(
          { draw: String(data.draw) },
          { $setOnInsert: data },
          { upsert: true }
        );

        if (upsertRes.upsertedCount && upsertRes.upsertedCount > 0) {
          console.log("✅ ACT data inserted:", data.draw);
        } else {
          console.log(
            "ℹ️  ACT draw already exists, skipped insert:",
            data.draw
          );
        }
      });

      await safeClose(browser);
      return data;
    } catch (err) {
      console.error("❌ runScraperOnce failed:", err.message);
      await safeClose(browser);
      throw err;
    }
  };

  return await retry(async () => {
    await killZombieChromium();
    return await runScraperOnce();
  });
};

// Fetch recent Keno results
export const getKenoResultsAtc = async (req, res) => {
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
export const getFilteredKenoResultsAtc = async (req, res) => {
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
