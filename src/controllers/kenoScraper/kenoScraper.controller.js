import puppeteer from "puppeteer";

export const scrapeNSWKeno = async () => {
  const url = "https://www.keno.com.au/check-results";
  let browser;

  try {
    browser = await puppeteer.launch({
      headless: true,
      executablePath:
        "/opt/render/.cache/puppeteer/chrome/linux-140.0.7339.80/chrome-linux64/chrome",
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    const page = await browser.newPage();
    await page.goto(url, { waitUntil: "networkidle2", timeout: 60000 });

    await page.waitForSelector(".game-ball-wrapper.is-drawn.is-placed", {
      timeout: 20000,
    });

    const data = await page.evaluate(() => {
      const balls = Array.from(
        document.querySelectorAll(".game-ball-wrapper.is-drawn.is-placed")
      ).map((el) => parseInt(el.textContent.trim(), 10));

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
