import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import { getChromiumPath } from "../../utils/chromiumPath.js";
import KenoResult from "../../models/NSWkenoDrawResult.model.js";
import util from "util";
import { getIO } from "../../utils/socketUtils.js";
import eventBus, { EVENTS } from "../../utils/eventBus.js";
import { exec } from "child_process";

const execAsync = util.promisify(exec);

// ✅ Use stealth plugin but disable problematic evasions
const stealth = StealthPlugin();
stealth.enabledEvasions.delete("user-agent-override");
stealth.enabledEvasions.delete("navigator.plugins");
stealth.enabledEvasions.delete("navigator.webdriver");
puppeteer.use(stealth);

// Sort numbers ascending for consistency
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
    if (process.platform === "win32") {
      await execAsync("taskkill /F /IM chrome.exe /T || taskkill /F /IM chromium.exe /T").catch(() => { });
    } else {
      await execAsync("pkill -f chromium || pkill -f chrome").catch(() => { });
    }
  } catch (_) { }
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
  const proxyUser = process.env.PROXY_USER_NSW || "db8ccea8814b4d971c00";
  const proxyPass = process.env.PROXY_PASS_NSW || "6be4142195f24494";
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

  const runScraperOnce = async () => {
    let browser, page;
    try {
      ({ browser, page } = await launchBrowser());

      // 🛰️ LIVE DATA FIX: Redirect ACT requests to NSW
      await page.setRequestInterception(true);
      page.on('request', interceptedRequest => {
        let url = interceptedRequest.url();
        if (url.includes('api-info') && url.includes('jurisdiction=ACT')) {
          const newUrl = url.replace('api-info-act', 'api-info-nsw').replace('jurisdiction=ACT', 'jurisdiction=NSW');
          interceptedRequest.continue({ url: newUrl });
        } else {
          interceptedRequest.continue();
        }
      });

      console.log("✈️ Navigating to:", targetUrl);
      const response = await page.goto(targetUrl, {
        waitUntil: "domcontentloaded",
        timeout: 45000,
      });

      if (!response || !response.ok()) {
        throw new Error(`Bad response: ${response?.status()}`);
      }

      // Allow some time for overlays/content to load
      await new Promise(r => setTimeout(r, 5000));

      // 🔍 Dismiss any popups that might be blocking the view
      await page.evaluate(() => {
        const closeSelectors = [
          '[data-id="close-login-dialog-button"]',
          '[data-id="close-continuous-play-modal-button"]',
          '[data-id="reward-game-expiring-modal-close"]',
          '[data-id="new-rewards-modal-close"]',
          '[data-id="feature-highlight-modal-close"]',
          '[data-id="suspended-account-modal-close-button"]',
          '[data-id="locked-account-modal-close-button"]',
          '[data-id="close-spend-limit-modal-button"]',
          '.close-button',
          '.modal-ok-button'
        ];
        closeSelectors.forEach(s => {
          const btn = document.querySelector(s);
          if (btn && typeof btn.click === 'function') {
            console.log("Dismissing popup via selector:", s);
            btn.click();
          }
        });
      });

      // Wait a bit after dismissing
      await new Promise(r => setTimeout(r, 2000));

      // 🔁 Switch to NSW region (if not already there)
      try {
        await page.waitForSelector('[data-id="selectedJurisdiction"]', { timeout: 10000 });
        const currentRegion = await page.evaluate(() => document.querySelector('[data-id="selectedJurisdiction"]')?.textContent?.trim());

        if (!currentRegion || !currentRegion.includes("NSW")) {
          console.log("📍 Switching region to NSW...");
          await page.click('[data-id="selectedJurisdiction"]');
          await new Promise(r => setTimeout(r, 1000));
          await page.evaluate(() => {
            const options = Array.from(document.querySelectorAll('li[role="option"]'));
            const nsw = options.find(el => el.textContent.includes("NSW"));
            if (nsw) nsw.click();
          });
          await new Promise(r => setTimeout(r, 3000));
        }
      } catch (e) {
        console.warn("⚠️ NSW Region switch failed:", e.message);
      }

      // Wait for results grid
      await page.waitForSelector(".game-board-grid", { timeout: 20000 });

      // 🔄 Extract ALL games visible on the page
      const games = await page.evaluate(() => {
        const dateInput = document.querySelector('input[data-id="check-results-date-input"]');
        const currentDate = dateInput ? dateInput.value.trim() : new Date().toLocaleDateString('en-AU').replace(/\//g, '-');

        const grids = Array.from(document.querySelectorAll(".game-board-grid"));

        return grids.map(grid => {
          const heading = grid.querySelector(".game-board-status-heading")?.textContent ||
            grid.querySelector(".game-number")?.textContent || "";

          const draw = heading.replace(/[^\d]/g, "");

          // Get ONLY the 20 drawn balls in this grid
          const balls = Array.from(grid.querySelectorAll(".game-ball-wrapper.is-drawn, .game-ball-wrapper.is-placed, .keno-ball.is-drawn, .keno-ball.is-placed"))
            .map(el => parseInt(el.textContent.trim(), 10))
            .filter(n => !isNaN(n));

          // Bonus search
          const findValueInGrid = (label) => {
            const elements = Array.from(grid.querySelectorAll("div, span, p, dt, label"));
            const match = elements.find(el => el.textContent.trim().toLowerCase().includes(label.toLowerCase()));
            if (!match) return "";
            const parent = match.parentElement;
            return parent?.querySelector("button, .pill, [class*='value'], .status-value")?.textContent?.trim() ||
              match.nextElementSibling?.textContent?.trim() || "";
          };

          const bonusLabel = grid.querySelector(
            ".game-results-status__multiplier-value, .game-status-bonus-value, .bonus-value, .game-bonus"
          )?.textContent?.trim() || findValueInGrid("bonus");

          // Result (Heads/Tails/Evens)
          const resultLabel = grid.querySelector(
            ".game-results-status__heads-tails-value, .game-status-heads-tails-value, .heads-tails-value, .heads-tails"
          )?.textContent?.trim() || findValueInGrid("heads or tails") || grid.innerText;

          return {
            draw,
            date: currentDate,
            numbers: balls,
            bonus: bonusLabel,
            rawText: grid.innerText // used for fallback parsing
          };
        }).filter(g => g.draw && g.numbers.length >= 20);
      });

      console.log(`📊 Scraped ${games.length} games from the page.`);

      // 📡 LIVE API FETCH: Capture absolute latest game from KDS
      try {
        const liveGame = await page.evaluate(async () => {
          const res = await fetch("https://api-info-nsw.keno.com.au/v2/games/kds?jurisdiction=NSW");
          const data = await res.json();
          if (data && data.current && data.current.draw) {
            return {
              draw: String(data.current["game-number"]),
              numbers: data.current.draw,
              result: data.current.variants?.["heads-or-tails"]?.result,
              bonus: data.current.variants?.bonus || "REG"
            };
          }
          return null;
        });

        if (liveGame && !games.find(g => g.draw === liveGame.draw)) {
          console.log(`📡 NSW: Found live game via API: Draw ${liveGame.draw}`);
          const dateInput = await page.evaluate(() => document.querySelector('input[data-id="check-results-date-input"]')?.value?.trim());
          const currentDate = dateInput || new Date().toLocaleDateString('en-AU').replace(/\//g, '-');
          games.push({ ...liveGame, date: currentDate, rawText: "" });
        }
      } catch (ae) { console.warn("⚠️ NSW Live API fetch failed:", ae.message); }

      const results = [];
      for (const game of games) {
        // Post-process each game: Ensure 20 numbers and sort them
        game.numbers = normalizeKenoNumbers(game.numbers);

        if (!hasValidKenoNumbers(game.numbers)) {
          console.warn(`⚠️ skipping draw ${game.draw} - incomplete numbers (${game.numbers.length})`);
          continue;
        }

        const headsCount = game.numbers.filter((n) => n >= 1 && n <= 40).length;
        const tailsCount = game.numbers.filter((n) => n >= 41 && n <= 80).length;
        game.heads = headsCount;
        game.tails = tailsCount;

        const rawResult = (game.result || "").toLowerCase();
        if (game.rawText.toLowerCase().includes("heads wins") || rawResult.includes("heads")) game.result = "Heads wins";
        else if (game.rawText.toLowerCase().includes("tails wins") || rawResult.includes("tails")) game.result = "Tails wins";
        else if (game.rawText.toLowerCase().includes("evens wins") || rawResult.includes("evens")) game.result = "Evens wins";
        else {
          if (headsCount > tailsCount) game.result = "Heads wins";
          else if (tailsCount > headsCount) game.result = "Tails wins";
          else game.result = "Evens wins";
        }

        const sanitizeBonus = (text) => {
          if (!text) return "REG";
          const cleaned = text.trim();
          if (cleaned.length > 10 || /login|account|password|enter|details|ready|ended|heads|tails|wins/i.test(cleaned)) {
            return "REG";
          }
          return cleaned || "REG";
        };
        game.bonus = sanitizeBonus(game.bonus);
        game.drawid = `${game.draw}_${game.date}`;
        game.location = "NSW";

        // Upsert to DB
        try {
          const existing = await KenoResult.findOne({ drawid: game.drawid })
            .select("_id numbers")
            .lean();

          let inserted = false;
          if (!existing) {
            await KenoResult.create(game);
            inserted = true;
          } else if (!hasValidKenoNumbers(existing.numbers || [])) {
            await KenoResult.updateOne({ _id: existing._id }, { $set: game });
            console.log(`🔧 NSW repaired malformed draw ${game.draw}`);
          }

          if (inserted) {
            console.log(`✅ NSW Inserted: Draw ${game.draw}`);
            results.push(game);

            // Socket & EventBus
            try {
              const io = getIO();
              io.emit("newResult", {
                type: "KENO",
                location: "NSW",
                ...game
              });
              eventBus.emit(EVENTS.NEW_RESULT_PUBLISHED, { type: "KENO", location: "NSW", data: game });
            } catch (_) { }
          }
        } catch (dbErr) {
          console.error(`❌ DB error for draw ${game.draw}:`, dbErr.message);
        }
      }

      await safeClose(browser);
      return results.length > 0 ? results[results.length - 1] : (games.length > 0 ? games[games.length - 1] : null);
    } catch (err) {
      console.error("❌ runScraperOnce failed:", err.message);
      await safeClose(browser);
      throw err;
    }
  };

  return await retry(async () => {
    await killZombieChromium();
    return await runScraperOnce();
  }, 2, 5000);
};

export const scrapeNSWKeno = scrapeNSWKenobyGame;

// Fetch recent/filtered results (unchanged logic but kept for consistency)
export const getKenoResults = async (req, res) => {
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
    res.status(500).json({ success: false, message: err.message });
  }
};

export const getFilteredKenoResults = async (req, res) => {
  try {
    const { firstGameNumber, lastGameNumber, date, limit = 50, page = 1 } = req.query;
    const filter = { numbers: { $size: 20 }, ...validNumbersExpr };

    if (firstGameNumber && lastGameNumber) {
      filter.draw = { $gte: String(firstGameNumber), $lte: String(lastGameNumber) };
    }
    if (date) {
      const start = new Date(date + "T00:00:00.000Z");
      const end = new Date(date + "T23:59:59.999Z");
      filter.createdAt = { $gte: start, $lte: end };
    }

    const limitNum = Number(limit);
    const skip = (Number(page) - 1) * limitNum;
    const totalResults = await KenoResult.countDocuments(filter);
    const results = await KenoResult.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limitNum);

    res.status(200).json({ success: true, total: totalResults, page: Number(page), limit: limitNum, results });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
