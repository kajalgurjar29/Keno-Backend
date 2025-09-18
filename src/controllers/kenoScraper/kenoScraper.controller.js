// import puppeteer from "puppeteer-core";
import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import chromium from "chromium";
import KenoResult from "../../models/kenoResult.model.js";
import { exec } from "child_process";
import util from "util";
const execAsync = util.promisify(exec);

puppeteer.use(StealthPlugin());

// Scraper function
export const scrapeNSWKeno = async () => {
  // Load proxy details from env (set in your .env file)
  const proxyHost = process.env.PROXY_HOST || "au.decodo.com";
  const proxyPort = process.env.PROXY_PORT || "30001";
  const proxyUser = process.env.PROXY_USER || "spr1wu95yq";
  const proxyPass = process.env.PROXY_PASS || "w06feLHNn1Cma3=ioy";

  const proxyUrl = `http://${proxyHost}:${proxyPort}`;

  const args = [
    "--no-sandbox",
    "--disable-setuid-sandbox",
    "--disable-dev-shm-usage",
    `--proxy-server=${proxyUrl}`,
  ];

  // Ensure Chromium path is correct
  const executablePath = process.env.CHROMIUM_PATH || chromium.path;

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

const filterIncreasingNumbers = (numbers) => {
  const result = [];
  for (let i = 0; i < numbers.length; i++) {
    if (i === 0 || numbers[i] >= numbers[i - 1]) {
      result.push(numbers[i]);
    } else break;
  }
  return result;
};

// Generic retry helper
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

// Kill leftover chrome/chromium processes (best-effort)
const killZombieChromium = async () => {
  try {
    // try pkill (linux), fallback to taskkill (windows)
    await execAsync("pkill -f chromium || pkill -f chrome");
    console.log("🛑 Killed leftover Chromium/Chrome processes (pkill).");
  } catch (e1) {
    try {
      // windows fallback
      await execAsync(
        "taskkill /F /IM chrome.exe /T || taskkill /F /IM chromium.exe /T"
      );
      console.log("🛑 Killed leftover Chromium/Chrome processes (taskkill).");
    } catch (e2) {
      console.warn(
        "⚠️ Could not kill leftover Chromium automatically:",
        e2.message
      );
    }
  }
};

// Safe close wrapper
const safeClose = async (browser) => {
  if (!browser) return;
  try {
    await browser.close();
  } catch (e) {
    console.warn("⚠️ Browser close failed:", e.message);
    try {
      // final attempt: kill processes
      await killZombieChromium();
    } catch (_) {}
  }
};

export const scrapeNSWKenobyGame = async () => {
  const proxyHost = process.env.PROXY_HOST || "au.decodo.com";
  const proxyPort = process.env.PROXY_PORT || "30001";
  const proxyUser = process.env.PROXY_USER || "spr1wu95yq";
  const proxyPass = process.env.PROXY_PASS || "w06feLHNn1Cma3=ioy";
  const executablePath = process.env.CHROMIUM_PATH || chromium.path;

  const proxyUrl = `http://${proxyHost}:${proxyPort}`;
  const targetUrl = "https://www.keno.com.au/check-results";

  // Launch browser helper (optionally with proxy)
  const launchBrowser = async (useProxy = true) => {
    const args = [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-background-networking",
      "--disable-background-timer-throttling",
      "--disable-renderer-backgrounding",
    ];
    if (useProxy) args.push(`--proxy-server=${proxyUrl}`);

    const browser = await puppeteer.launch({
      headless: true,
      executablePath,
      args,
      // if you want watchers: pipe: true
    });

    const page = await browser.newPage();
    // sensible viewport
    await page.setViewport({ width: 1280, height: 900 });

    if (useProxy && proxyUser && proxyPass) {
      try {
        await page.authenticate({ username: proxyUser, password: proxyPass });
      } catch (e) {
        console.warn("⚠️ Proxy authentication failed:", e.message);
      }
    }

    // Attach listeners to detect crashes early
    page.on("error", (err) => {
      console.error("Page error event:", err && err.message);
    });
    page.on("pageerror", (err) => {
      console.error("Page runtime error:", err && err.message);
    });
    browser.on("disconnected", () => {
      console.error("Browser disconnected event fired.");
    });

    return { browser, page };
  };

  // The core single-run function
  const runScraperOnce = async (useProxyFirst = true) => {
    let browser = null;
    let page = null;

    try {
      // ensure zombies killed before starting
      await killZombieChromium();

      // Try with proxy first, then fallback
      try {
        ({ browser, page } = await launchBrowser(useProxyFirst));
        console.log(`⤴️ Browser launched (proxy=${useProxyFirst})`);
        await page.goto(targetUrl, {
          waitUntil: "domcontentloaded",
          timeout: 45000, // 45s
        });
      } catch (initialErr) {
        console.warn("⚠️ First navigation attempt failed:", initialErr.message);
        await safeClose(browser);
        // fallback: try without proxy
        ({ browser, page } = await launchBrowser(false));
        console.log("⤵️ Launched browser without proxy (fallback).");
        await page.goto(targetUrl, {
          waitUntil: "domcontentloaded",
          timeout: 45000,
        });
      }

      // Wait for either ball elements or some result marker
      await retry(
        () =>
          page.waitForSelector(
            ".game-ball-wrapper, .keno-ball, .draw-result, .game-board",
            {
              timeout: 15000, // 15s
            }
          ),
        3,
        3000
      );

      // Extract with retries (in case frame re-attaches quickly)
      const data = await retry(
        async () =>
          page.evaluate(() => {
            // Attempt multiple selectors for resilience
            const allBalls = Array.from(
              document.querySelectorAll(
                ".game-ball-wrapper, .keno-ball, .draw-result"
              )
            );

            // Some sites use nested spans — gather text recursively
            const parseNumber = (el) => {
              if (!el) return NaN;
              const txt = el.textContent || el.innerText || "";
              const found = txt.trim().match(/\d+/);
              return found ? parseInt(found[0], 10) : NaN;
            };

            const balls = allBalls
              .filter((el) => {
                // prefer 'is-drawn' class if present otherwise include
                if (el.classList && el.classList.contains("is-drawn"))
                  return true;
                // fallback: include if contains numeric text
                return /\d+/.test(el.textContent || el.innerText || "");
              })
              .map(parseNumber)
              .filter((n) => !isNaN(n));

            const drawText =
              document.querySelector(".game-board-status-heading")
                ?.textContent ||
              document.querySelector(".game-number")?.textContent ||
              document.querySelector(".draw-number")?.textContent ||
              "";

            const dateText =
              document.querySelector(
                'input[data-id="check-results-date-input"]'
              )?.value ||
              document.querySelector(".draw-date")?.textContent ||
              "";

            return {
              draw: String(drawText).replace(/[^\d]/g, "").trim(),
              date: String(dateText).trim(),
              numbers: balls,
            };
          }),
        3,
        2000
      );

      // Keep only increasing prefix to avoid malformed extra numbers
      data.numbers = filterIncreasingNumbers(data.numbers);

      // Save to DB with duplicate handling
      try {
        const result = new KenoResult(data);
        await result.save();
        console.log("✅ Scraped data saved:", result);
      } catch (dbErr) {
        if (dbErr && dbErr.code === 11000) {
          console.warn(`⚠️ Duplicate draw skipped: ${data.draw}`);
        } else {
          throw dbErr;
        }
      }

      // Close browser cleanly
      await safeClose(browser);
      return data;
    } catch (err) {
      console.error("❌ runScraperOnce failed:", err && err.message);

      // attempt to capture screenshot & html for debugging
      try {
        if (page) {
          const snapshotPath = `keno_error_${Date.now()}.png`;
          await page.screenshot({ path: snapshotPath, fullPage: true });
          console.log("📸 Screenshot saved:", snapshotPath);

          const html = await page.content();
          console.log(
            "🧾 HTML snapshot (first 1000 chars):",
            html.substring(0, 1000)
          );
        }
      } catch (snapErr) {
        console.warn("⚠️ Could not capture snapshot:", snapErr.message);
      }

      // ensure browser killed
      await safeClose(browser);

      // rethrow for outer retry handling
      throw err;
    }
  };

  // Outer retry loop: try several times and ensure zombie processes are cleared between tries
  const maxAttempts = 3;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      console.log(`🔄 Scraping attempt ${attempt}/${maxAttempts}`);
      // prefer proxy on first attempt, fallback logic inside runScraperOnce will handle navigation fallback
      const data = await runScraperOnce(attempt === 1);
      console.log("🎯 Scrape finished successfully.");
      return data;
    } catch (err) {
      console.error(`❌ Attempt ${attempt} failed:`, err && err.message);
      // try to kill leftover processes and wait a bit before next attempt
      try {
        await killZombieChromium();
      } catch (kerr) {
        console.warn(
          "⚠️ killZombieChromium failed after attempt:",
          kerr.message
        );
      }
      if (attempt < maxAttempts) {
        console.log("⏳ Waiting 5s before next attempt...");
        await new Promise((r) => setTimeout(r, 5000));
      } else {
        console.error("💥 All attempts failed. Throwing error upstream.");
        throw err;
      }
    }
  }
};

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

