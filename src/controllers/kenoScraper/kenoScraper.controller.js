import puppeteer from "puppeteer";

export const scrapeNSWKeno = async () => {
  const url = "https://www.keno.com.au/check-results";

  // Launch Puppeteer in server-friendly mode
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"], // required for containerized environments
  });

  const page = await browser.newPage();
  await page.goto(url, { waitUntil: "networkidle2", timeout: 60000 });

  // Wait for at least one drawn ball to ensure the game board is loaded
  await page.waitForSelector(".game-ball-wrapper.is-drawn.is-placed", {
    timeout: 20000,
  });

  const data = await page.evaluate(() => {
    const balls = Array.from(
      document.querySelectorAll(".game-ball-wrapper.is-drawn.is-placed")
    )
      .map((el) => parseInt(el.textContent.trim(), 10))
      .filter((n) => !isNaN(n));

    // Draw number
    const drawText =
      document.querySelector(".game-board-status-heading")?.textContent ||
      document.querySelector(".game-number")?.textContent ||
      "";

    // Draw date (from input)
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
};
