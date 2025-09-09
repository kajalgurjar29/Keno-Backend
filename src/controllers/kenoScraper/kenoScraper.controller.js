import puppeteer from "puppeteer";

export const scrapeNSWKeno = async () => {
  let browser;
  try {
    browser = await puppeteer.launch({
      headless: true,
      executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
        "--no-zygote",
        "--single-process",
      ],
    });

    const page = await browser.newPage();
    await page.goto("https://www.keno.com.au/check-results", {
      waitUntil: "networkidle2",
      timeout: 60000,
    });

    await page.waitForSelector(".game-ball-wrapper.is-drawn.is-placed", {
      timeout: 20000,
    });

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

    return data;
  } catch (err) {
    console.error("Scraping error:", err.message);
    return { error: err.message };
  } finally {
    if (browser) await browser.close();
  }
};
