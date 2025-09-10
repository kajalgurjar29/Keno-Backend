// import puppeteer from "puppeteer-core";
// import chromium from "chromium";

// export const scrapeNSWKeno = async () => {
//   const browser = await puppeteer.launch({
//     headless: true,
//     executablePath: process.env.CHROMIUM_PATH || chromium.path,
//     args: [
//       "--no-sandbox",
//       "--disable-setuid-sandbox",
//       "--disable-dev-shm-usage",
//     ],
//   });
//   const page = await browser.newPage();
//   await page.goto("https://www.keno.com.au/check-results", {
//     waitUntil: "networkidle2",
//     timeout: 60000,
//   });

//   await page.waitForSelector(".game-ball-wrapper.is-drawn.is-placed", {
//     timeout: 20000,
//   });

//   const data = await page.evaluate(() => {
//     const balls = Array.from(
//       document.querySelectorAll(".game-ball-wrapper.is-drawn.is-placed")
//     )
//       .map((el) => parseInt(el.textContent.trim(), 10))
//       .filter((n) => !isNaN(n));

//     const drawText =
//       document.querySelector(".game-board-status-heading")?.textContent ||
//       document.querySelector(".game-number")?.textContent ||
//       "";

//     const dateText =
//       document.querySelector('input[data-id="check-results-date-input"]')
//         ?.value || "";

//     return {
//       draw: drawText.replace(/[^\d]/g, ""),
//       date: dateText.trim(),
//       numbers: balls,
//     };
//   });
//   await browser.close();
//   return data;
// };

import puppeteer from "puppeteer-core";
import chromium from "chromium";

export const scrapeNSWKeno = async () => {
  const browser = await puppeteer.launch({
    headless: true,
    executablePath: process.env.CHROMIUM_PATH || chromium.path,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
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
  await browser.close();
  return data;
};
