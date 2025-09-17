import puppeteer from "puppeteer-core";
import chromium from "chromium";
import KenoResult from "../../models/kenoResult.model.js";

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

// Filter helper
const filterIncreasingNumbers = (numbers) => {
  const result = [];
  for (let i = 0; i < numbers.length; i++) {
    if (i === 0 || numbers[i] >= numbers[i - 1]) {
      result.push(numbers[i]);
    } else {
      break;
    }
  }
  return result;
};

// Small retry helper
const retry = async (fn, retries = 3, delay = 2000) => {
  let lastError;
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      console.warn(`Retry ${i + 1}/${retries} failed: ${err.message}`);
      if (
        err.message.includes("frame got detached") ||
        err.message.includes("Execution context was destroyed")
      ) {
        await new Promise((res) => setTimeout(res, delay));
        continue;
      }
      throw err;
    }
  }
  throw lastError;
};

export const scrapeNSWKenobyGame = async () => {
  const proxyHost = process.env.PROXY_HOST || "au.decodo.com";
  const proxyPort = process.env.PROXY_PORT || "30001";
  const proxyUser = process.env.PROXY_USER || "spr1wu95yq";
  const proxyPass = process.env.PROXY_PASS || "w06feLHNn1Cma3=ioy";
  const executablePath = process.env.CHROMIUM_PATH || chromium.path;

  const proxyUrl = `http://${proxyHost}:${proxyPort}`;

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
      await page.authenticate({
        username: proxyUser,
        password: proxyPass,
      });
    }

    return { browser, page };
  };

  let browser, page;
  try {
    // ---- First try with proxy ----
    try {
      ({ browser, page } = await launchBrowser(true));
      await page.goto("https://www.keno.com.au/check-results", {
        waitUntil: "networkidle2",
        timeout: 120000,
      });
    } catch (proxyErr) {
      if (proxyErr.message.includes("ERR_TUNNEL_CONNECTION_FAILED")) {
        console.warn("⚠️ Proxy failed, retrying without proxy...");
        if (browser) await browser.close();
        ({ browser, page } = await launchBrowser(false));
        await page.goto("https://www.keno.com.au/check-results", {
          waitUntil: "networkidle2",
          timeout: 120000,
        });
      } else {
        throw proxyErr;
      }
    }

    // Wait for game-ball-wrapper to appear
    await retry(() =>
      page.waitForSelector(".game-ball-wrapper", { timeout: 60000 })
    );

    const data = await retry(async () => {
      return await page.evaluate(() => {
        const allBalls = Array.from(
          document.querySelectorAll(".game-ball-wrapper")
        );

        const balls = allBalls
          .filter((el) => el.classList.contains("is-drawn"))
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
    });

    data.numbers = filterIncreasingNumbers(data.numbers);

    // Save (skip duplicates)
    try {
      const result = new KenoResult(data);
      await result.save();
      console.log("✅ Scraped data saved:", result);
    } catch (dbErr) {
      if (dbErr.code === 11000) {
        console.warn(`⚠️ Duplicate draw skipped: ${data.draw}`);
      } else {
        throw dbErr;
      }
    }

    await browser.close();
    return data;
  } catch (err) {
    console.error("❌ Scraping failed:", err.message);
    if (browser) await browser.close();
    throw err;
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
