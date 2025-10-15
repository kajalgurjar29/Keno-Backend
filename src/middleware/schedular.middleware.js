// import schedule from "node-schedule";
// import { scrapeNSWKenobyGame } from "../controllers/kenoScraper/NSWkenoDrawNumberScraper.controller.js";

// let running = false;
// schedule.scheduleJob("*/5 * * * * *", async () => {
//   if (running) return;
//   running = true;
//   console.log("Job triggered at", new Date().toLocaleString());
//   try {
//     const result = await scrapeNSWKenobyGame();
//     console.log("Scraped and saved:", result);
//   } catch (err) {
//     console.error("Error scraping Keno:", err.message);
//   }
//   running = false;
// });

// import schedule from "node-schedule";
// import { scrapeNSWKenobyGame } from "../controllers/kenoScraper/NSWkenoDrawNumberScraper.controller.js";
// import { scrapeVICKenoByGame } from "../controllers/kenoScraper/VICkenoDrawNumberScraper.controller.js";

// // 🟢 NSW Scraper Scheduler
// let runningNSW = false;
// schedule.scheduleJob("*/5 * * * * *", async () => {
//   if (runningNSW) return;
//   runningNSW = true;
//   console.log("🕐 NSW Job triggered at", new Date().toLocaleString());

//   try {
//     const result = await scrapeNSWKenobyGame();
//     console.log("✅ NSW Scraped and saved:", result);
//   } catch (err) {
//     console.error("❌ NSW Scraper error:", err.message);
//   }

//   runningNSW = false;
// });

// // 🟢 VIC Scraper Scheduler
// let runningVIC = false;
// schedule.scheduleJob("*/7 * * * * *", async () => {
//   if (runningVIC) return;
//   runningVIC = true;
//   console.log("🕐 VIC Job triggered at", new Date().toLocaleString());

//   try {
//     const result = await scrapeVICKenoByGame();
//     console.log("✅ VIC Scraped and saved:", result);
//   } catch (err) {
//     console.error("❌ VIC Scraper error:", err.message);
//   }

//   runningVIC = false;
// });

import schedule from "node-schedule";
import { scrapeNSWKenobyGame } from "../controllers/kenoScraper/NSWkenoDrawNumberScraper.controller.js";
import { scrapeVICKenoByGame } from "../controllers/kenoScraper/VICkenoDrawNumberScraper.controller.js";
import { scrapeACTKenoByGame } from "../controllers/kenoScraper/ACTkenoDrawNumberScraper.controller.js";

// 🟢 NSW Scraper Scheduler (every 1 minute)
let runningNSW = false;
schedule.scheduleJob("*/1 * * * *", async () => {
  if (runningNSW) return;
  runningNSW = true;
  console.log("🕐 NSW Job triggered at", new Date().toLocaleString());

  try {
    const result = await scrapeNSWKenobyGame();
    console.log("✅ NSW Scraped and saved:", result);
  } catch (err) {
    console.error("❌ NSW Scraper error:", err.message);
  }

  runningNSW = false;
});

// 🟢 VIC Scraper Scheduler (every 2 minutes)
let runningVIC = false;
schedule.scheduleJob("*/2 * * * *", async () => {
  if (runningVIC) return;
  runningVIC = true;
  console.log("🕐 VIC Job triggered at", new Date().toLocaleString());

  try {
    const result = await scrapeVICKenoByGame();
    console.log("✅ VIC Scraped and saved:", result);
  } catch (err) {
    console.error("❌ VIC Scraper error:", err.message);
  }

  runningVIC = false;
});

// 🟢 ACT Scraper Scheduler (every 3 minutes)
let runningACT = false;
schedule.scheduleJob("*/3 * * * *", async () => {
  if (runningACT) return;
  runningACT = true;
  console.log("🕐 ACT Job triggered at", new Date().toLocaleString());

  try {
    const result = await scrapeACTKenoByGame();
    console.log("✅ ACT Scraped and saved:", result);
  } catch (err) {
    console.error("❌ ACT Scraper error:", err.message);
  }

  runningACT = false;
});
