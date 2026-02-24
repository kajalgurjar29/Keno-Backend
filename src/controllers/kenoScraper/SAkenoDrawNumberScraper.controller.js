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
import axios from "axios";
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
  const unique = [
    ...new Set(
      numbers
        .map((n) => Number(n))
        .filter((n) => Number.isInteger(n) && n >= 1 && n <= 80),
    ),
  ];
  return sortNumbers(unique);
};

const hasValidKenoNumbers = (numbers = []) =>
  Array.isArray(numbers) &&
  numbers.length === 20 &&
  new Set(numbers).size === 20;

const sameNumbers = (a = [], b = []) =>
  Array.isArray(a) &&
  Array.isArray(b) &&
  a.length === b.length &&
  a.every((n, idx) => n === b[idx]);

const validNumbersExpr = {
  $expr: {
    $eq: [{ $size: "$numbers" }, { $size: { $setUnion: ["$numbers", []] } }],
  },
};

const SA_KDS_ENDPOINT =
  "https://api-info-sa.keno.com.au/v2/games/kds?jurisdiction=SA";
const SA_HISTORY_ENDPOINT =
  "https://api-info-sa.keno.com.au/v2/info/history?jurisdiction=SA";
const MAX_DRAW_AHEAD = 0;

const formatSaRecordDate = (value) => {
  const dt = value ? new Date(value) : new Date();
  const validDate = Number.isNaN(dt.getTime()) ? new Date() : dt;
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Australia/Adelaide",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  })
    .format(validDate)
    .split("/");
  return `${parts[0]}-${parts[1]}-${parts[2]}`;
};

const sanitizeBonus = (text) => {
  if (!text) return "REG";
  const cleaned = String(text).trim();
  if (
    cleaned.length > 10 ||
    /login|account|password|enter|details|ready|ended|heads|tails|wins/i.test(
      cleaned,
    )
  ) {
    return "REG";
  }
  return cleaned || "REG";
};

const normalizeResultLabel = (rawResult, rawText, headsCount, tailsCount) => {
  const result = String(rawResult || "").toLowerCase();
  const text = String(rawText || "").toLowerCase();
  if (text.includes("heads wins") || result.includes("heads"))
    return "Heads wins";
  if (text.includes("tails wins") || result.includes("tails"))
    return "Tails wins";
  if (text.includes("evens wins") || result.includes("evens"))
    return "Evens wins";
  if (headsCount > tailsCount) return "Heads wins";
  if (tailsCount > headsCount) return "Tails wins";
  return "Evens wins";
};

const drawNumFromValue = (value) => {
  const n = Number(value);
  return Number.isInteger(n) ? n : null;
};

const dedupeByDraw = (games = []) => {
  const byDraw = new Map();
  for (const game of games) {
    const draw = String(game?.draw || "").trim();
    if (!draw) continue;

    const normalized = normalizeKenoNumbers(game.numbers || []);
    const score =
      normalized.length + (game.result ? 1 : 0) + (game.bonus ? 1 : 0);
    const existing = byDraw.get(draw);
    if (!existing || score > existing.score) {
      byDraw.set(draw, { score, game: { ...game, draw, numbers: normalized } });
    }
  }
  return Array.from(byDraw.values()).map((v) => v.game);
};

const getSaLiveDrawCeiling = async () => {
  try {
    const { data } = await axios.get(SA_KDS_ENDPOINT, {
      timeout: 12000,
      proxy: false,
    });
    return drawNumFromValue(data?.current?.["game-number"]);
  } catch {
    return null;
  }
};

const fetchSaApiSnapshot = async () => {
  try {
    const [kdsRes, historyRes] = await Promise.all([
      axios.get(SA_KDS_ENDPOINT, { timeout: 12000, proxy: false }),
      axios.get(SA_HISTORY_ENDPOINT, { timeout: 12000, proxy: false }),
    ]);

    const current = kdsRes.data?.current || {};
    const currentDrawNum = drawNumFromValue(current["game-number"]);
    const currentDate = formatSaRecordDate(
      current.receivedDrawingAt || new Date(),
    );

    const items = Array.isArray(historyRes.data?.items)
      ? historyRes.data.items
      : [];
    const fromHistory = items.map((item) => ({
      draw: String(item?.["game-number"] || ""),
      date: formatSaRecordDate(item?.closed || new Date()),
      numbers: Array.isArray(item?.draw) ? item.draw : [],
      result: item?.variants?.["heads-or-tails"]?.result || "",
      bonus: item?.variants?.bonus || "REG",
      rawText: "",
    }));

    const allGames = [...fromHistory];
    if (
      currentDrawNum !== null &&
      Array.isArray(current.draw) &&
      current.draw.length > 0
    ) {
      allGames.push({
        draw: String(currentDrawNum),
        date: currentDate,
        numbers: current.draw,
        result: current?.variants?.["heads-or-tails"]?.result || "",
        bonus: current?.variants?.bonus || "REG",
        rawText: "",
      });
    }

    return {
      currentDrawNum,
      games: dedupeByDraw(allGames),
    };
  } catch (err) {
    console.warn("⚠️ SA API snapshot fetch failed:", err.message);
    return { currentDrawNum: null, games: [] };
  }
};

const pruneSaOutlierDraws = async (currentDrawNum) => {
  if (!Number.isInteger(currentDrawNum)) return;
  const cutoff = currentDrawNum + MAX_DRAW_AHEAD;
  const result = await KenoResult.deleteMany({
    $expr: {
      $gt: [
        {
          $convert: {
            input: "$draw",
            to: "int",
            onError: -1,
            onNull: -1,
          },
        },
        cutoff,
      ],
    },
  });
  if (result.deletedCount > 0) {
    console.warn(
      `🧹 SA cleaned ${result.deletedCount} outlier rows above draw ${cutoff}`,
    );
  }
};

const persistSaGames = async (games = [], options = {}) => {
  const currentDrawNum = drawNumFromValue(options.currentDrawNum);
  if (Number.isInteger(currentDrawNum)) {
    await pruneSaOutlierDraws(currentDrawNum);
  }

  const dedupedGames = dedupeByDraw(games)
    .map((game) => ({ ...game, draw: String(game.draw).trim() }))
    .filter((game) => game.draw);

  const filtered = dedupedGames.filter((game) => {
    const drawNum = drawNumFromValue(game.draw);
    if (drawNum === null) return false;
    if (
      Number.isInteger(currentDrawNum) &&
      drawNum > currentDrawNum + MAX_DRAW_AHEAD
    ) {
      console.warn(
        `⚠️ SA skipping suspicious draw ${game.draw} > live ${currentDrawNum}`,
      );
      return false;
    }
    return true;
  });

  filtered.sort((a, b) => Number(a.draw) - Number(b.draw));

  const resultsList = [];

  for (const game of filtered) {
    game.numbers = normalizeKenoNumbers(game.numbers);
    if (!hasValidKenoNumbers(game.numbers)) {
      console.warn(
        `⚠️ skipping draw ${game.draw} - invalid numbers (${game.numbers.length})`,
      );
      continue;
    }

    const headsCount = game.numbers.filter((n) => n >= 1 && n <= 40).length;
    const tailsCount = game.numbers.filter((n) => n >= 41 && n <= 80).length;
    game.heads = headsCount;
    game.tails = tailsCount;
    game.result = normalizeResultLabel(
      game.result,
      game.rawText,
      headsCount,
      tailsCount,
    );
    game.bonus = sanitizeBonus(game.bonus);
    game.date = game.date || formatSaRecordDate(new Date());
    game.drawid = `${game.draw}_${game.date}`;
    game.location = "SA";

    await retry(async () => {
      const existing = await KenoResult.findOne({ drawid: game.drawid })
        .select("_id numbers result bonus")
        .lean();

      let inserted = false;
      if (!existing) {
        await KenoResult.create(game);
        inserted = true;
      } else {
        const existingNumbers = normalizeKenoNumbers(existing.numbers || []);
        const invalidExisting = !hasValidKenoNumbers(existing.numbers || []);
        const numberMismatch = !sameNumbers(existingNumbers, game.numbers);
        const resultMismatch = (existing.result || "") !== (game.result || "");
        const bonusMismatch =
          (existing.bonus || "REG") !== (game.bonus || "REG");

        if (
          invalidExisting ||
          numberMismatch ||
          resultMismatch ||
          bonusMismatch
        ) {
          await KenoResult.updateOne({ _id: existing._id }, { $set: game });
          console.log(`🔧 SA corrected draw ${game.draw}`);
        }
      }

      if (inserted) {
        console.log(`✅ SA data inserted: ${game.draw} on ${game.date}`);
        resultsList.push(game);
        try {
          const io = getIO();
          io.emit("newResult", { type: "KENO", location: "SA", ...game });
          eventBus.emit(EVENTS.NEW_RESULT_PUBLISHED, {
            type: "KENO",
            location: "SA",
            data: game,
          });
        } catch (_) {}
      }
    });
  }

  const latestGame = filtered.length > 0 ? filtered[filtered.length - 1] : null;

  return {
    latestGame,
    insertedCount: resultsList.length,
    processedCount: filtered.length,
  };
};

// Keep compatibility with existing route naming.
export const scrapeSAKeno = async () => {
  return scrapeSAKenoByGame();
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
      const apiSnapshot = await fetchSaApiSnapshot();
      if (apiSnapshot.games.length > 0) {
        console.log(
          `📡 SA API mode: ${apiSnapshot.games.length} games, current draw ${apiSnapshot.currentDrawNum ?? "n/a"}`,
        );
        const persisted = await persistSaGames(apiSnapshot.games, {
          currentDrawNum: apiSnapshot.currentDrawNum,
        });
        if (persisted.latestGame) return persisted.latestGame;
      }

      ({ browser, page } = await launchBrowser());

      // Force SA requests when page defaults to another jurisdiction
      await page.setRequestInterception(true);
      page.on("request", (interceptedRequest) => {
        const url = interceptedRequest.url();
        if (
          url.includes("api-info") &&
          /jurisdiction=(VIC|NSW|ACT)/.test(url)
        ) {
          const newUrl = url
            .replace(/api-info-(vic|nsw|act)/i, "api-info-sa")
            .replace(/jurisdiction=(VIC|NSW|ACT)/, "jurisdiction=SA");
          interceptedRequest.continue({ url: newUrl });
        } else {
          interceptedRequest.continue();
        }
      });

      const response = await page.goto(targetUrl, {
        waitUntil: "domcontentloaded",
        timeout: 45000,
      });
      if (!response || !response.ok())
        throw new Error(`Bad response: ${response?.status()}`);

      await new Promise((r) => setTimeout(r, 5000));

      // Dismiss blocking modals/popups
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
          ".close-button",
          ".modal-ok-button",
        ];
        closeSelectors.forEach((s) => {
          const btn = document.querySelector(s);
          if (btn && typeof btn.click === "function") btn.click();
        });
      });

      await new Promise((r) => setTimeout(r, 2000));

      // Switch region to SA
      try {
        await page.waitForSelector('[data-id="selectedJurisdiction"]', {
          timeout: 10000,
        });
        const currentRegion = await page.evaluate(() =>
          document
            .querySelector('[data-id="selectedJurisdiction"]')
            ?.textContent?.trim(),
        );
        if (!currentRegion || !currentRegion.includes("SA")) {
          console.log("📍 Switching region to SA...");
          await page.click('[data-id="selectedJurisdiction"]');
          await new Promise((r) => setTimeout(r, 1000));
          await page.evaluate(() => {
            const options = Array.from(
              document.querySelectorAll('li[role="option"]'),
            );
            const sa = options.find((el) => el.textContent.includes("SA"));
            if (sa) sa.click();
          });
          await new Promise((r) => setTimeout(r, 4000));
        }
      } catch (e) {
        // Fallback for older selector on some deployments
        try {
          await page.waitForSelector(
            '[data-id="check-results-region-selector"]',
            { timeout: 8000 },
          );
          await page.click('[data-id="check-results-region-selector"]');
          await new Promise((r) => setTimeout(r, 1000));
          await page.evaluate(() => {
            const options = Array.from(
              document.querySelectorAll('li[role="option"]'),
            );
            const sa = options.find((el) => el.textContent.includes("SA"));
            if (sa) sa.click();
          });
          await new Promise((r) => setTimeout(r, 4000));
        } catch {
          console.warn("Could not switch to SA region:", e.message);
        }
      }

      // Hard guard: do not ingest if SA jurisdiction is not selected
      const activeRegion = await page.evaluate(() => {
        return (
          document
            .querySelector('[data-id="selectedJurisdiction"]')
            ?.textContent?.trim() ||
          document
            .querySelector('[data-id="check-results-region-selector"]')
            ?.textContent?.trim() ||
          ""
        );
      });
      if (!String(activeRegion).includes("SA")) {
        throw new Error(
          `SA jurisdiction not active (current: ${activeRegion || "unknown"})`,
        );
      }

      await page.waitForSelector(".game-board-grid", { timeout: 20000 });

      const games = await page.evaluate(() => {
        const dateInput = document.querySelector(
          'input[data-id="check-results-date-input"]',
        );
        const currentDate = dateInput
          ? dateInput.value.trim()
          : new Date().toLocaleDateString("en-AU").replace(/\//g, "-");

        const grids = Array.from(document.querySelectorAll(".game-board-grid"));

        return grids
          .map((grid) => {
            const heading =
              grid.querySelector(".game-board-status-heading")?.textContent ||
              grid.querySelector(".game-number")?.textContent ||
              "";
            const draw = heading.replace(/[^\d]/g, "");
            const balls = Array.from(
              grid.querySelectorAll(
                ".game-ball-wrapper.is-drawn, .game-ball-wrapper.is-placed, .keno-ball.is-drawn, .keno-ball.is-placed",
              ),
            )
              .map((el) => parseInt(el.textContent.trim(), 10))
              .filter((n) => !isNaN(n));

            const findValueInGrid = (label) => {
              const elements = Array.from(
                grid.querySelectorAll("div, span, p, dt, label"),
              );
              const match = elements.find((el) =>
                el.textContent
                  .trim()
                  .toLowerCase()
                  .includes(label.toLowerCase()),
              );
              if (!match) return "";
              const parent = match.parentElement;
              return (
                parent
                  ?.querySelector(
                    "button, .pill, [class*='value'], .status-value",
                  )
                  ?.textContent?.trim() ||
                match.nextElementSibling?.textContent?.trim() ||
                ""
              );
            };

            const bonusLabel =
              grid
                .querySelector(
                  ".game-results-status__multiplier-value, .game-status-bonus-value, .bonus-value, .game-bonus",
                )
                ?.textContent?.trim() || findValueInGrid("bonus");

            const resultLabel =
              grid
                .querySelector(
                  ".game-results-status__heads-tails-value, .game-status-heads-tails-value, .heads-tails-value, .heads-tails",
                )
                ?.textContent?.trim() ||
              findValueInGrid("heads or tails") ||
              "";

            return {
              draw,
              date: currentDate,
              numbers: balls,
              bonus: bonusLabel,
              result: resultLabel,
              rawText: grid.innerText || "",
            };
          })
          .filter((g) => g.draw && g.numbers.length >= 20);
      });

      console.log(`📊 SA: Scraped ${games.length} games from DOM.`);

      let liveDrawCeiling = null;
      try {
        const liveGame = await page.evaluate(async () => {
          const res = await fetch(
            "https://api-info-sa.keno.com.au/v2/games/kds?jurisdiction=SA",
          );
          const data = await res.json();
          if (data && data.current && data.current.draw) {
            return {
              draw: String(data.current["game-number"]),
              numbers: data.current.draw,
              result: data.current.variants?.["heads-or-tails"]?.result,
              bonus: data.current.variants?.bonus || "REG",
            };
          }
          return null;
        });

        if (liveGame && !games.find((g) => g.draw === liveGame.draw)) {
          console.log(`📡 SA: Found live game via API: Draw ${liveGame.draw}`);
          liveDrawCeiling = drawNumFromValue(liveGame.draw);
          const dateInput = await page.evaluate(() =>
            document
              .querySelector('input[data-id="check-results-date-input"]')
              ?.value?.trim(),
          );
          const currentDate =
            dateInput ||
            new Date().toLocaleDateString("en-AU").replace(/\//g, "-");
          games.push({ ...liveGame, date: currentDate, rawText: "" });
        }
      } catch (ae) {
        console.warn("⚠️ SA live API fetch failed:", ae.message);
      }
      const persisted = await persistSaGames(games, {
        currentDrawNum: liveDrawCeiling,
      });

      await safeClose(browser);
      return (
        persisted.latestGame ||
        (games.length > 0 ? games[games.length - 1] : null)
      );
    } catch (err) {
      console.error("❌ SA scraper failed:", err.message);
      await safeClose(browser);
      throw err;
    }
  };

  return await retry(
    async () => {
      await killZombieChromium();
      return await runScraperOnce();
    },
    2,
    5000,
  );
};

// Fetch recent Keno results
export const getKenoResultsSa = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const liveDrawCeiling = await getSaLiveDrawCeiling();

    const pipeline = [
      {
        $match: {
          numbers: { $size: 20 },
          ...validNumbersExpr,
        },
      },
      {
        $addFields: {
          drawNum: {
            $convert: {
              input: "$draw",
              to: "int",
              onError: -1,
              onNull: -1,
            },
          },
        },
      },
    ];

    if (Number.isInteger(liveDrawCeiling)) {
      pipeline.push({
        $match: { drawNum: { $lte: liveDrawCeiling + MAX_DRAW_AHEAD } },
      });
    }

    pipeline.push(
      { $sort: { createdAt: -1, drawNum: -1 } },
      { $limit: limit },
      { $project: { drawNum: 0 } },
    );

    const results = await KenoResult.aggregate(pipeline);

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
    const shouldApplyLiveCeiling =
      !date && !startDate && !endDate && !firstGameNumber && !lastGameNumber;
    const liveDrawCeiling = shouldApplyLiveCeiling
      ? await getSaLiveDrawCeiling()
      : null;
    const exprConditions = [validNumbersExpr.$expr];
    if (shouldApplyLiveCeiling && Number.isInteger(liveDrawCeiling)) {
      exprConditions.push({
        $lte: [
          {
            $convert: {
              input: "$draw",
              to: "int",
              onError: -1,
              onNull: -1,
            },
          },
          liveDrawCeiling + MAX_DRAW_AHEAD,
        ],
      });
    }
    filter.$expr =
      exprConditions.length === 1
        ? exprConditions[0]
        : { $and: exprConditions };

    // Convert page and limit to numbers
    const limitNum = Number(limit);
    const pageNum = Number(page);
    const skip = (pageNum - 1) * limitNum;

    // Debug: see filter object
    console.log("🔹 Filter object:", filter, "Skip:", skip, "Limit:", limitNum);

    // Get total count for pagination info
    const totalResults = await KenoResult.countDocuments(filter);

    const results = await KenoResult.aggregate([
      { $match: filter },
      {
        $addFields: {
          drawNum: {
            $convert: {
              input: "$draw",
              to: "int",
              onError: -1,
              onNull: -1,
            },
          },
        },
      },
      { $sort: { drawNum: -1, createdAt: -1 } },
      { $skip: skip },
      { $limit: limitNum },
      { $project: { drawNum: 0 } },
    ]);

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
