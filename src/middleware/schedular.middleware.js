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

// import schedule from "node-schedule";
// import { scrapeNSWKenobyGame } from "../controllers/kenoScraper/NSWkenoDrawNumberScraper.controller.js";
// import { scrapeVICKenoByGame } from "../controllers/kenoScraper/VICkenoDrawNumberScraper.controller.js";
// import { scrapeACTKenoByGame } from "../controllers/kenoScraper/ACTkenoDrawNumberScraper.controller.js";

// // 🟢 NSW Scraper Scheduler (every 1 minute)
// let runningNSW = false;
// schedule.scheduleJob("*/1 * * * *", async () => {
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

// // 🟢 VIC Scraper Scheduler (every 2 minutes)
// let runningVIC = false;
// schedule.scheduleJob("*/2 * * * *", async () => {
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

// // 🟢 ACT Scraper Scheduler (every 3 minutes)
// let runningACT = false;
// schedule.scheduleJob("*/3 * * * *", async () => {
//   if (runningACT) return;
//   runningACT = true;
//   console.log("🕐 ACT Job triggered at", new Date().toLocaleString());

//   try {
//     const result = await scrapeACTKenoByGame();
//     console.log("✅ ACT Scraped and saved:", result);
//   } catch (err) {
//     console.error("❌ ACT Scraper error:", err.message);
//   }

//   runningACT = false;
// });

import schedule from "node-schedule";
import { scrapeNSWKenobyGame } from "../controllers/kenoScraper/NSWkenoDrawNumberScraper.controller.js";
import { scrapeVICKenoByGame } from "../controllers/kenoScraper/VICkenoDrawNumberScraper.controller.js";
import { scrapeACTKenoByGame } from "../controllers/kenoScraper/ACTkenoDrawNumberScraper.controller.js";
import { scrapeSAKenoByGame } from "../controllers/kenoScraper/SAkenoDrawNumberScraper.controller.js";
import { scrapeTrackSideResultsWithRetry as scrapeNSWTrackside } from "../controllers/TracksiteScaper/NSWTrackSideScraperScaping.controller.js";
import { scrapeTrackSideResultsWithRetry as scrapeVICTrackside } from "../controllers/TracksiteScaper/VICTrackSideScraperScaping.controller.js";
import { scrapeTrackSideResultsWithRetry as scrapeACTTrackside } from "../controllers/TracksiteScaper/ACTTrackSideScraperScaping.controller.js";

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
  if (runningACT) {
    console.log("⏸️ ACT Scraper already running, skipping...");
    return;
  }
  runningACT = true;
  console.log("🕐 ACT Job triggered at", new Date().toLocaleString());

  try {
    const result = await scrapeACTKenoByGame();
    console.log("✅ ACT Scraped and saved:", result);
  } catch (err) {
    // Log error but don't crash the server
    console.error("❌ ACT Scraper error:", err.message);
    // Only log first few lines of stack trace to avoid clutter
    if (err.stack && err.message.includes("Target closed")) {
      console.error(
        "   (This is a known Puppeteer issue - browser connection lost)"
      );
    }
  } finally {
    runningACT = false;
  }
});

// 🟢 SA Scraper Scheduler (every 4 minutes)
let runningSA = false;
schedule.scheduleJob("*/4 * * * *", async () => {
  if (runningSA) return;
  runningSA = true;
  console.log("🕐 SA Job triggered at", new Date().toLocaleString());

  try {
    const result = await scrapeSAKenoByGame();
    console.log("✅ SA Scraped and saved:", result);
  } catch (err) {
    console.error("❌ SA Scraper error:", err.message);
  }

  runningSA = false;
});

// 🟢 TrackSide Scheduler (every 5 minutes) - run NSW, VIC, ACT scrapers sequentially
let runningTrackSide = false;
schedule.scheduleJob("*/5 * * * *", async () => {
  if (runningTrackSide) return;
  runningTrackSide = true;
  console.log("🕐 TrackSide Job triggered at", new Date().toLocaleString());

  try {
    console.log("➡️ Running NSW TrackSide scraper...");
    await scrapeNSWTrackside();
  } catch (err) {
    console.error("❌ NSW TrackSide error:", err.message || err);
  }

  try {
    console.log("➡️ Running VIC TrackSide scraper...");
    await scrapeVICTrackside();
  } catch (err) {
    console.error("❌ VIC TrackSide error:", err.message || err);
  }

  try {
    console.log("➡️ Running ACT TrackSide scraper...");
    await scrapeACTTrackside();
  } catch (err) {
    console.error("❌ ACT TrackSide error:", err.message || err);
  }

  runningTrackSide = false;
});
