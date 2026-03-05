import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import { getChromiumPath } from "../../utils/chromiumPath.js";
import KenoResult from "../../models/NSWkenoDrawResult.model.js";
import util from "util";
import { getIO } from "../../utils/socketUtils.js";
import eventBus, { EVENTS } from "../../utils/eventBus.js";
import { exec } from "child_process";

const execAsync = util.promisify(exec);

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

const retry = async (fn, retries = 3, delay = 2000) => {
  let lastError;
  for (let i = 0; i < retries; i++) {
    try { return await fn(); }
    catch (err) { lastError = err; if (i < retries - 1) await new Promise((r) => setTimeout(r, delay)); }
  }
  throw lastError;
};

const killZombieChromium = async () => {
  try {
    if (process.platform === "win32") {
      await execAsync("taskkill /F /IM chrome.exe /T || taskkill /F /IM chromium.exe /T").catch(() => { });
    }
  } catch (_) { }
};

const safeClose = async (browser) => {
  if (!browser) return;
  try { await browser.close(); } catch { await killZombieChromium(); }
};

// 🔧 Repair function to fix old data missing fields
const repairNSWData = async () => {
  try {
    const malformed = await KenoResult.find({
      $or: [
        { location: { $exists: false } },
        { location: "" },
        { result: { $exists: false } }
      ]
    }).limit(100);

    if (malformed.length > 0) {
      console.log(`🔧 NSW: Repairing ${malformed.length} malformed records...`);
      for (const doc of malformed) {
        const heads = doc.numbers.filter(n => n >= 1 && n <= 40).length;
        const tails = doc.numbers.filter(n => n >= 41 && n <= 80).length;
        const result = heads > tails ? "Heads wins" : (tails > heads ? "Tails wins" : "Evens wins");

        await KenoResult.updateOne(
          { _id: doc._id },
          { $set: { location: "NSW", result: doc.result || result } }
        );
      }
    }
  } catch (e) { console.warn("Repair failed:", e.message); }
};

export const scrapeNSWKenobyGame = async () => {
  // Run repair at the start
  await repairNSWData();

  const proxyHost = process.env.PROXY_HOST || "au.decodo.com";
  const proxyPort = process.env.PROXY_PORT || "30001";
  const proxyUser = process.env.PROXY_USER_NSW || "spr1wu95yq";
  const proxyPass = process.env.PROXY_PASS_NSW || "w06feLHNn1Cma3=ioy";
  const executablePath = getChromiumPath() || null;
  const proxyUrl = `http://${proxyHost}:${proxyPort}`;
  const targetUrl = "https://www.keno.com.au/check-results";

  const launchBrowser = async () => {
    const args = ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage", `--proxy-server=${proxyUrl}`];
    const browser = await puppeteer.launch({ headless: true, executablePath, args });
    const page = await browser.newPage();
    if (proxyUser && proxyPass) await page.authenticate({ username: proxyUser, password: proxyPass });
    await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36");
    return { browser, page };
  };

  const runScraperOnce = async () => {
    let browser, page;
    try {
      ({ browser, page } = await launchBrowser());

      console.log("✈️ NSW: Navigating to results...");
      const response = await page.goto(targetUrl, { waitUntil: "networkidle2", timeout: 60000 });
      if (!response || !response.ok()) throw new Error(`Bad response: ${response?.status()}`);

      await new Promise(r => setTimeout(r, 6000));

      // Dismiss popups
      await page.evaluate(() => {
        const closeSelectors = ['[data-id="close-login-dialog-button"]', '[data-id="close-continuous-play-modal-button"]', '.close-button', '.modal-ok-button'];
        closeSelectors.forEach(s => {
          const btn = document.querySelector(s);
          if (btn && typeof btn.click === 'function') btn.click();
        });
      });

      // Switch Region
      try {
        await page.waitForSelector('[data-id="selectedJurisdiction"]', { timeout: 15000 });
        let region = await page.evaluate(() => document.querySelector('[data-id="selectedJurisdiction"]')?.textContent?.trim() || "");
        if (!region.includes("NSW")) {
          console.log(`📍 Region switch needed (Current: ${region}). Target: NSW`);
          await page.click('[data-id="selectedJurisdiction"]');
          await new Promise(r => setTimeout(r, 2000));
          await page.evaluate(() => {
            const items = Array.from(document.querySelectorAll('li[role="option"]'));
            const nsw = items.find(el => el.textContent.includes("NSW"));
            if (nsw) nsw.click();
          });
          await new Promise(r => setTimeout(r, 5000));
        }
      } catch (e) { console.warn("NSW Region switch failed:", e.message); }

      await page.waitForSelector(".game-board-grid", { timeout: 30000 });

      const games = await page.evaluate(() => {
        const dateInput = document.querySelector('input[data-id="check-results-date-input"]');
        const currentDate = dateInput ? dateInput.value.trim() : new Date().toLocaleDateString('en-AU').replace(/\//g, '-');
        const grids = Array.from(document.querySelectorAll(".game-board-grid"));

        return grids.map(grid => {
          const heading = grid.querySelector(".game-board-status-heading")?.textContent || grid.querySelector(".game-number")?.textContent || "";
          const draw = heading.replace(/[^\d]/g, "");
          const balls = Array.from(grid.querySelectorAll(".game-ball-wrapper.is-drawn, .game-ball-wrapper.is-placed, .keno-ball.is-drawn, .keno-ball.is-placed"))
            .map(el => parseInt(el.textContent.trim(), 10)).filter(n => !isNaN(n));
          const resultLabel = grid.querySelector(".heads-tails-value")?.textContent?.trim() || grid.innerText;
          const bonusLabel = grid.querySelector(".bonus-value")?.textContent?.trim() || "";

          return { draw, date: currentDate, numbers: balls, result: resultLabel, bonus: bonusLabel, rawText: grid.innerText };
        }).filter(g => g.draw && g.numbers.length >= 20);
      });

      console.log(`📊 NSW: Scraped ${games.length} games from DOM.`);

      const resultsSaved = [];
      for (const game of games) {
        game.numbers = normalizeKenoNumbers(game.numbers);
        if (!hasValidKenoNumbers(game.numbers)) continue;

        const headsCount = game.numbers.filter(n => n >= 1 && n <= 40).length;
        const tailsCount = game.numbers.filter(n => n >= 41 && n <= 80).length;
        game.heads = headsCount;
        game.tails = tailsCount;
        const rawResult = (game.result || "").toLowerCase();
        if (rawResult.includes("heads")) game.result = "Heads wins";
        else if (rawResult.includes("tails")) game.result = "Tails wins";
        else if (rawResult.includes("evens")) game.result = "Evens wins";
        else game.result = headsCount > tailsCount ? "Heads wins" : (tailsCount > headsCount ? "Tails wins" : "Evens wins");

        game.bonus = (game.bonus || "").length < 5 ? (game.bonus || "REG") : "REG";
        game.drawid = `${game.draw}_${game.date}`;
        game.location = "NSW";

        try {
          const existing = await KenoResult.findOne({ drawid: game.drawid }).lean();
          if (!existing) {
            await KenoResult.create(game);
            console.log(`💾 NSW Stored: Draw ${game.draw}`);
            resultsSaved.push(game);
            try {
              const io = getIO();
              io.emit("newResult", { type: "KENO", location: "NSW", ...game });
              eventBus.emit(EVENTS.NEW_RESULT_PUBLISHED, { type: "KENO", location: "NSW", data: game });
            } catch (_) { }
          } else {
            console.log(`⏩ NSW: Draw ${game.draw} already exists in DB.`);
          }
        } catch (dbErr) { console.error(`❌ NSW DB error:`, dbErr.message); }
      }

      await safeClose(browser);
      return resultsSaved.length > 0 ? resultsSaved[resultsSaved.length - 1] : (games.length > 0 ? games[games.length - 1] : null);
    } catch (err) {
      console.error("❌ NSW Scraper failed:", err.message);
      await safeClose(browser);
      throw err;
    }
  };

  return await retry(async () => { return await runScraperOnce(); }, 2, 5000);
};

export const scrapeNSWKeno = scrapeNSWKenobyGame;
export const getKenoResults = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    let results = await KenoResult.find({ numbers: { $size: 20 }, ...validNumbersExpr })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    // Safety: ensure location is present for frontend
    results = results.map(r => ({ ...r, location: r.location || "NSW" }));

    res.status(200).json({ success: true, results });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};
export const getFilteredKenoResults = async (req, res) => {
  try {
    const { firstGameNumber, lastGameNumber, date, limit = 50, page = 1 } = req.query;
    const filter = { numbers: { $size: 20 }, ...validNumbersExpr };
    if (firstGameNumber && lastGameNumber) filter.draw = { $gte: String(firstGameNumber), $lte: String(lastGameNumber) };
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
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};
