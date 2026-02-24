// import puppeteer from "puppeteer-core";
import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import chromium from "chromium";
import fs from "fs";
import { execSync } from "child_process";
import { exec } from "child_process";
import { getChromiumPath } from "../../utils/chromiumPath.js";
import KenoResult from "../../models/SAkenoDrawResult.model.js";
import util from "util";
import { getIO } from "../../utils/socketUtils.js";
import eventBus, { EVENTS } from "../../utils/eventBus.js";
const execAsync = util.promisify(exec);

//  Use stealth plugin but disable problematic evasions
const stealth = StealthPlugin();
stealth.enabledEvasions.delete("user-agent-override");
stealth.enabledEvasions.delete("navigator.plugins");
stealth.enabledEvasions.delete("navigator.webdriver");
puppeteer.use(stealth);

const sortNumbers = (numbers) => {
  return [...numbers].sort((a, b) => a - b);
};

const normalizeKenoNumbers = (numbers = []) => {
  const unique = [...new Set(
    numbers
      .map((n) => Number(n))
      .filter((n) => Number.isInteger(n) && n >= 1 && n <= 80)
  )];
  return sortNumbers(unique);
};

const hasValidKenoNumbers = (numbers = []) => (
  Array.isArray(numbers) &&
  numbers.length === 20 &&
  new Set(numbers).size === 20
);

const validNumbersExpr = {
  $expr: {
    $eq: [
      { $size: "$numbers" },
      { $size: { $setUnion: ["$numbers", []] } },
    ],
  },
};

// Scraper function
export const scrapeSAKeno = async () => {
  //  Proxy details
  const proxyHost = process.env.PROXY_HOST || "au.decodo.com";
  const proxyPort = process.env.PROXY_PORT || "30001";
  const proxyUser = process.env.PROXY_USER_SA || "spr1wu95yq";
  const proxyPass = process.env.PROXY_PASS_SA || "w06feLHNn1Cma3=ioy";

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

    // ✅ Try to switch region to SA
    try {
      console.log("🔁 Switching to SA region...");
      await page.waitForSelector('[data-id="check-results-region-selector"]', {
        timeout: 15000,
      });
      await page.click('[data-id="check-results-region-selector"]');

      await page.waitForTimeout(1000); // give dropdown time to open

      await page.evaluate(() => {
        const options = Array.from(
          document.querySelectorAll('li[role="option"]'),
        );
        const sa = options.find((el) => el.textContent.includes("SA"));
        if (sa) sa.click();
      });

      // ⚠️ ❌ REMOVE waitForNavigation() to avoid frame detach
      // ✅ Instead, wait for the results container to update
      await page.waitForSelector(".game-ball-wrapper", { timeout: 30000 });
      await page.waitForTimeout(2000); // small delay to ensure data loads
    } catch (e) {
      console.warn("⚠️ Could not switch to SA automatically:", e.message);
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
        document.querySelectorAll(".game-ball-wrapper:not(.is-blank)"),
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

    result.numbers = normalizeKenoNumbers(result.numbers);
    if (!hasValidKenoNumbers(result.numbers)) {
      throw new Error(`Invalid SA numbers extracted (${result.numbers.length})`);
    }

    console.log("🎯 Final SA Keno Result:", result);
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
        "taskkill /F /IM chrome.exe /T || taskkill /F /IM chromium.exe /T",
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

export const scrapeSAKenoByGame = async () => {
  const proxyHost = process.env.PROXY_HOST || "au.decodo.com";
  const proxyPort = process.env.PROXY_PORT || "30001";
  const proxyUser = process.env.PROXY_USER_SA || "spr1wu95yq";
  const proxyPass = process.env.PROXY_PASS_SA || "w06feLHNn1Cma3=ioy";
  const executablePath = getChromiumPath() || null;

  const proxyUrl = `http://${proxyHost}:${proxyPort}`;
  const targetUrl = "https://www.keno.com.au/check-results";

  const launchBrowser = async () => {
    const args = [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      `--proxy-server=${proxyUrl}`,
    ];

    const browser = await puppeteer.launch({
      headless: true,
      executablePath,
      args,
    });

    const page = await browser.newPage();
    await page.authenticate({ username: proxyUser, password: proxyPass });

    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) " +
        "AppleWebKit/537.36 (KHTML, like Gecko) " +
        "Chrome/124.0.0.0 Safari/537.36",
    );
    await page.setExtraHTTPHeaders({ "Accept-Language": "en-US,en;q=0.9" });

    return { browser, page };
  };

  const runScraperOnce = async () => {
    let browser, page;
    try {
      ({ browser, page } = await launchBrowser());

      const response = await page.goto(targetUrl, {
        waitUntil: "domcontentloaded",
        timeout: 30000,
      });
      if (!response || !response.ok())
        throw new Error(`Bad response: ${response?.status()}`);

      // Check for Akamai block
      const bodyText = await page.evaluate(() => document.body.innerText);
      if (/Access Denied|blocked|verify/i.test(bodyText)) {
        throw new Error("Blocked by Akamai (Access Denied)");
      }

      // Switch region to SA
      try {
        await page.waitForSelector(
          '[data-id="check-results-region-selector"]',
          {
            timeout: 15000,
          },
        );
        await page.click('[data-id="check-results-region-selector"]');
        await page.waitForTimeout(1000);
        await page.evaluate(() => {
          const options = Array.from(
            document.querySelectorAll('li[role="option"]'),
          );
          const sa = options.find((el) => el.textContent.includes("SA"));
          if (sa) sa.click();
        });
        await page.waitForSelector(".game-ball-wrapper", { timeout: 30000 });
        await page.waitForTimeout(2000);
      } catch (e) {
        console.warn("Could not switch to SA region:", e.message);
      }

      // Wait for results
      await retry(() =>
        page.waitForSelector(".game-ball-wrapper, .keno-ball", {
          timeout: 15000,
        }),
      );

      // Extract draw data
      const data = await page.evaluate(() => {
        const balls = Array.from(
          document.querySelectorAll(".game-ball-wrapper, .keno-ball"),
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

        const bonusText =
          document.querySelector(
            ".game-results-status__multiplier-value, .game-status-bonus-value, .bonus-value, .game-bonus",
          )?.textContent || "";
        const headsTailsText =
          document.querySelector(
            ".game-results-status__heads-tails-value, .game-status-heads-tails-value, .heads-tails-value, .heads-tails",
          )?.textContent || "";

        // Fallback search by label if direct selectors fail
        const findByLabel = (label) => {
          const elements = Array.from(
            document.querySelectorAll("div, span, p, dt, label"),
          );
          const match = elements.find((el) =>
            el.textContent.trim().toLowerCase().includes(label.toLowerCase()),
          );
          if (!match) return "";
          const parent = match.parentElement;
          return (
            parent
              ?.querySelector("button, .pill, [class*='value'], .status-value")
              ?.textContent?.trim() ||
            match.nextElementSibling?.textContent?.trim() ||
            ""
          );
        };

        const finalBonus = bonusText.trim() || findByLabel("bonus");
        const finalHT = headsTailsText.trim() || findByLabel("heads or tails");

        return {
          draw: drawText.replace(/[^\d]/g, ""),
          date: dateText.trim(),
          numbers: balls,
          bonus: finalBonus,
          headsTailsLabel: finalHT,
        };
      });

      data.numbers = normalizeKenoNumbers(data.numbers);
      if (!hasValidKenoNumbers(data.numbers)) {
        throw new Error(`Invalid SA numbers extracted (${data.numbers.length})`);
      }

      // Calculate heads/tails stats
      const headsCount = data.numbers.filter((n) => n >= 1 && n <= 40).length;
      const tailsCount = data.numbers.filter((n) => n >= 41 && n <= 80).length;
      data.heads = headsCount;
      data.tails = tailsCount;

      if (headsCount > tailsCount) data.result = "Heads wins";
      else if (tailsCount > headsCount) data.result = "Tails wins";
      else data.result = "Evens wins";

      // Sanitizing bonus to avoid "junk text" from login/account sections
      const sanitizeBonus = (text) => {
        if (!text) return "REG";
        const cleaned = text.trim();
        if (
          cleaned.length > 10 ||
          /login|account|password|enter|details|ready|ended/i.test(cleaned)
        ) {
          return "REG";
        }
        return cleaned || "REG";
      };

      data.bonus = sanitizeBonus(data.bonus);

      // Create drawid for uniqueness checking (draw + date combination)
      data.drawid = `${data.draw}_${data.date}`;
      data.location = "SA";

      // Save to DB and repair malformed historical rows for same drawid
      await retry(async () => {
        const existing = await KenoResult.findOne({ drawid: data.drawid })
          .select("_id numbers")
          .lean();

        let inserted = false;
        if (!existing) {
          await KenoResult.create(data);
          inserted = true;
        } else if (!hasValidKenoNumbers(existing.numbers || [])) {
          await KenoResult.updateOne({ _id: existing._id }, { $set: data });
          console.log("🔧 SA repaired malformed draw:", data.draw, "on", data.date);
        }

        if (inserted) {
          console.log("✅ SA data inserted:", data.draw, "on", data.date);

          // Socket Emission for new results
          try {
            const io = getIO();
            io.emit("newResult", {
              type: "KENO",
              location: "SA",
              draw: data.draw,
              numbers: data.numbers,
              heads: data.heads,
              tails: data.tails,
              result: data.result,
              bonus: data.bonus,
            });
            console.log("📡 SA Keno: Emitted 'newResult' socket event");

            // 🆕 Emit Background Event for Alert Matching & Notifications
            eventBus.emit(EVENTS.NEW_RESULT_PUBLISHED, {
              type: "KENO",
              location: "SA",
              data: data,
            });
          } catch (socketErr) {
            console.warn("⚠️ SA Keno: Socket emit failed:", socketErr.message);
          }
        } else {
          console.log(
            "ℹ️  SA draw already exists for this date, skipped insert:",
            data.draw,
            "on",
            data.date,
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
export const getKenoResultsSa = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const results = await KenoResult.find({
      numbers: { $size: 20 },
      ...validNumbersExpr,
    })
      .sort({ createdAt: -1 })
      .limit(limit);

    res.status(200).json({ success: true, results });
  } catch (err) {
    console.error("Failed to fetch Keno results:", err.message);
    res.status(500).json({ success: false, message: err.message });
  }
};

// Fetch filtered Keno results and pagination
export const getFilteredKenoResultsSa = async (req, res) => {
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

    // Enforce 20 numbers rule
    if (filter.numbers) {
      filter.numbers.$size = 20;
    } else {
      filter.numbers = { $size: 20 };
    }
    filter.$expr = validNumbersExpr.$expr;

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
