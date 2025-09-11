import puppeteer from "puppeteer-core";
import chromium from "chromium";

export const scrapeNSWKeno = async () => {
  const proxy = "spr1wu95yq:w06feLHNn1Cma3=ioy@au.decodo.com:30001";

  const args = [
    "--no-sandbox",
    "--disable-setuid-sandbox",
    "--disable-dev-shm-usage",
    `--proxy-server=http://${proxy}`,
  ];

  // Make sure chromium is installed on server, else use puppeteer-core fails
  const executablePath = process.env.CHROMIUM_PATH || chromium.path;

  const browser = await puppeteer.launch({
    headless: true,
    executablePath,
    args,
  });

  const page = await browser.newPage();

  // If your proxy requires authentication in a popup (Decodo sometimes does)
  if (proxy.includes("@")) {
    const [auth] = proxy.split("@");
    const [username, password] = auth.split(":");
    await page.authenticate({ username, password });
  }

  try {
    await page.goto("https://www.keno.com.au/check-results", {
      waitUntil: "networkidle2",
      timeout: 60000,
    });

    // Wait longer if server is slow behind proxy
    await page.waitForSelector(".game-ball-wrapper.is-drawn.is-placed", {
      timeout: 40000,
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

    await browser.close();
    return data;
  } catch (err) {
    await browser.close();
    throw new Error("Scraping failed: " + err.message);
  }
};
